/*
 * WCS metadata class
 *
 * This file is part of the ImageSolver and AnnotateImage scripts.
 *
 * Copyright (C) 2012-2023, Andres del Pozo
 * Copyright (C) 2019-2023, Juan Conejero (PTeam)
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 * ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

#define Ext_DataType_Complex      1000  // Complex object with settings
#define Ext_DataType_StringArray  1001  // Array of strings
#define Ext_DataType_JSON         1002  // Serializable object

#define WCS_MAX_STARS_IN_SOLUTION 50000
#define WCS_MAX_SPLINE_POINTS     2100

#include "Projections.js"
#include <pjsr/PropertyType.jsh>
#include <pjsr/PropertyAttribute.jsh>
#include <pjsr/RBFType.jsh>
;

/*
 * ObjectWithSettings: Base class for persistent classes.
 */
function ObjectWithSettings( module, prefix, properties )
{
   this.module = module;
   this.prefix = prefix ? prefix.replace( / /g, '' ) : null;
   this.properties = properties;

   this.MakeSettingsKey = function( property )
   {
      let key = "";
      if( this.module && this.module.length > 0 )
         key = this.module + "/";
      if( this.prefix && prefix.length > 0 )
         key = key + this.prefix + "/";
      return key + property;
   };

   this.LoadSettings = function()
   {
      for ( let i = 0; i < this.properties.length; ++i )
      {
         let property = this.properties[i][0];
         if ( property )
            if ( this.properties[i][1] == Ext_DataType_Complex )
            {
               if ( this[property] && typeof( this[property].LoadSettings ) === 'function' )
                  this[property].LoadSettings();
            }
            else if ( this.properties[i][1] == Ext_DataType_JSON )
            {
               let value = Settings.read( this.MakeSettingsKey( property ), DataType_UCString );
               if ( Settings.lastReadOK )
                  this[property] = JSON.parse( value );
            }
            else if ( this.properties[i][1] == Ext_DataType_StringArray )
            {
               let value = Settings.read( this.MakeSettingsKey( property ), DataType_UCString );
               if ( Settings.lastReadOK )
                  this[property] = value.split("|");
            }
            else
            {
               let value = Settings.read( this.MakeSettingsKey( property ), this.properties[i][1] );
               if ( Settings.lastReadOK )
                  this[property] = value;
            }
      }
   };

   this.SaveSettings = function()
   {
      for ( let i = 0; i < this.properties.length; ++i )
      {
         let property = this.properties[i][0];
         if ( this[property] != null )
         {
            if ( this.properties[i][1] == Ext_DataType_Complex )
               this[property].SaveSettings();
            else if ( this.properties[i][1] == Ext_DataType_JSON )
               Settings.write( this.MakeSettingsKey( property ), DataType_UCString, JSON.stringify( this[property] ) );
            else if ( this.properties[i][1] == Ext_DataType_StringArray )
            {
               let concatString = this.CreateStringArray( this[property] );
               if ( concatString != null )
                  Settings.write( this.MakeSettingsKey( property ), DataType_UCString, concatString );
            }
            else
               Settings.write( this.MakeSettingsKey( property ), this.properties[i][1], this[property] );
         }
         else
            Settings.remove( this.MakeSettingsKey( property ) );
      }
   };

   this.DeleteSettings = function()
   {
      Settings.remove( this.prefix );
   };

   this.MakeParamsKey = function( property )
   {
      let key = "";
      if ( this.prefix && this.prefix.length > 0 )
         key = this.prefix.replace( "-", "" ) + "_";
      return key + property;
   };

   this.LoadParameters = function()
   {
      for ( let i = 0; i < this.properties.length; ++i )
      {
         let property = this.properties[i][0];
         if ( property )
            if ( this.properties[i][1] == Ext_DataType_Complex )
               this[property].LoadParameters();
            else
            {
               let key = this.MakeParamsKey( property );
               if ( Parameters.has( key ) )
               {
                  switch( this.properties[i][1] )
                  {
                  case DataType_Boolean:
                     this[property] = Parameters.getBoolean( key );
                     break;
                  case DataType_Int8:
                  case DataType_UInt8:
                  case DataType_Int16:
                  case DataType_UInt16:
                  case DataType_Int32:
                  case DataType_UInt32:
                  case DataType_Int64:
                  case DataType_UInt64:
                     this[property] = parseInt( Parameters.get( key ) );
                     break;
                  case DataType_Double:
                  case DataType_Float:
                     this[property] = Parameters.getReal( key );
                     break;
                  case DataType_String:
                  case DataType_UCString:
                     this[property] = Parameters.getString( key );
                     break;
                  case Ext_DataType_JSON:
                     // TODO: This is necessary because PI 1.8 doesn't allow " in strings
                     this[property] = JSON.parse( Parameters.getString( key ).replace( /\'\'/g, "\"" ) );
                     break;
                  case Ext_DataType_StringArray:
                     {
                        let value = Parameters.getString( key );
                        if ( value )
                           this[property] = value.split( "|" );
                     }
                     break;
                  default:
                     console.writeln( "Unknown property type '", this.properties[i][1] + "'" );
                  }
               }
            }
      }
   };

   this.SaveParameters = function()
   {
      for ( let i = 0; i < this.properties.length; ++i )
      {
         let property = this.properties[i][0];
         if ( this[property] != null )
         {
            if ( this.properties[i][1] == Ext_DataType_Complex )
               this[property].SaveParameters();
            else if ( this.properties[i][1] == Ext_DataType_JSON )
            {
               // TODO: This is necessary because PI 1.8 doesn't allow " in strings
               Parameters.set( this.MakeParamsKey( property ),
                               JSON.stringify( this[property] ).replace( /\"/g, "\'\'" ) );
            }
            else if( this.properties[i][1] == Ext_DataType_StringArray )
            {
               let array = this.CreateStringArray(this[property]);
               if ( array != null )
                  Parameters.set( this.MakeParamsKey( property ), array );
            }
            else
               Parameters.set( this.MakeParamsKey( property ), this[property] );
         }
      }
   };

   this.CreateStringArray = function( array )
   {
      let str = null;
      for ( let j = 0; j < array.length; ++j )
         if ( array[j] )
            str = (str == null) ? array[j] : str + "|" + array[j];
         else
            str = (str == null) ? "" : str + "|";
      return str;
   };
}

// ----------------------------------------------------------------------------

function WCSKeywords()
{
   this.radesys = null;
   this.objctra = null;
   this.objctdec = null;
   this.epoch = null;
   this.endTime = null;
   this.longobs = null;
   this.latobs = null;
   this.altobs = null;
   this.focallen = null;
   this.xpixsz = null;
   this.ctype1 = null;
   this.ctype2 = null;
   this.crval1 = null;
   this.crval2 = null;
   this.crpix1 = null;
   this.crpix2 = null;
   this.pv1_1 = null;
   this.pv1_2 = null;
   this.lonpole = null;
   this.latpole = null;
   this.cd1_1 = null;
   this.cd1_2 = null;
   this.cd2_1 = null;
   this.cd2_2 = null;
   this.cdelt1 = null;
   this.cdelt2 = null;
   this.crota1 = null;
   this.crota2 = null;

   // Synthesized observation time from DATE-OBS and DATE-END/EXPTIME.
   this.observationTime = null;

   this.Read = function( window )
   {
      let expTime = null; // only if Observation:Time:End is not available

      let view = window.mainView;

      /*
       * Basic image metadata
       */
      if ( view.hasProperty( "Observation:CelestialReferenceSystem" ) )
         this.radesys = view.propertyValue( "Observation:CelestialReferenceSystem" );
      if ( view.hasProperty( "Observation:Center:RA" ) )
         this.objctra = view.propertyValue( "Observation:Center:RA" );
      if ( view.hasProperty( "Observation:Center:Dec" ) )
         this.objctdec = view.propertyValue( "Observation:Center:Dec" );
      if ( view.hasProperty( "Observation:Time:Start" ) )
         this.epoch = Math.calendarTimeToJD( view.propertyValue( "Observation:Time:Start" ).toISOString() );
      if ( view.hasProperty( "Observation:Time:End" ) )
         this.endTime = Math.calendarTimeToJD( view.propertyValue( "Observation:Time:End" ).toISOString() );
      if ( view.hasProperty( "Observation:Location:Longitude" ) )
         this.longobs = view.propertyValue( "Observation:Location:Longitude" );
      if ( view.hasProperty( "Observation:Location:Latitude" ) )
         this.latobs = view.propertyValue( "Observation:Location:Latitude" );
      if ( view.hasProperty( "Observation:Location:Elevation" ) )
         this.altobs = view.propertyValue( "Observation:Location:Elevation" );
      if ( view.hasProperty( "Instrument:Telescope:FocalLength" ) )
         this.focallen = view.propertyValue( "Instrument:Telescope:FocalLength" ) * 1000;
      if ( view.hasProperty( "Instrument:Sensor:XPixelSize" ) )
         this.xpixsz = view.propertyValue( "Instrument:Sensor:XPixelSize" );
      if ( view.hasProperty( "Instrument:ExposureTime" ) )
         expTime = view.propertyValue( "Instrument:ExposureTime" );

      /*
       * Native astrometric solution - since core version 1.8.9-2
       * ### TODO: When defined by the XISF standard, remove the PCL prefix.
       */
      if ( view.hasProperty( "PCL:AstrometricSolution:ProjectionSystem" ) )
      {
         let projId = view.propertyValue( "PCL:AstrometricSolution:ProjectionSystem" );
         let wcsCode = "";
         switch ( projId )
         {
         case "Gnomonic":
            wcsCode = "TAN";
            break;
         case "Stereographic":
            wcsCode = "STG";
            break;
         case "PlateCarree":
            wcsCode = "CAR";
            break;
         case "Mercator":
            wcsCode = "MER";
            break;
         case "HammerAitoff":
            wcsCode = "AIT";
            break;
         case "ZenithalEqualArea":
            wcsCode = "ZEA";
            break;
         case "Orthographic":
            wcsCode = "SIN";
            break;
         default:
            throw new Error( "WCSKeywords: Invalid/unsupported projection identifier \'" + projId + '\'' );
         }
         this.ctype1 = "'RA---" + wcsCode + "'";
         this.ctype2 = "'DEC--" + wcsCode + "'";
      }

      if ( view.hasProperty( "PCL:AstrometricSolution:ReferenceCelestialCoordinates" ) )
      {
         let p = view.propertyValue( "PCL:AstrometricSolution:ReferenceCelestialCoordinates" );
         if ( (p instanceof Vector) && p.length >= 2 )
         {
            this.crval1 = p.at( 0 );
            this.crval2 = p.at( 1 );
         }
         else
            console.warningln( "** Warning: WCSKeywords: Invalid PCL:AstrometricSolution:ReferenceCelestialCoordinates property value." );
      }

      if ( view.hasProperty( "PCL:AstrometricSolution:ReferenceImageCoordinates" ) )
      {
         let p = view.propertyValue( "PCL:AstrometricSolution:ReferenceImageCoordinates" );
         if ( (p instanceof Vector) && p.length >= 2 )
         {
            this.crpix1 = p.at( 0 );
            this.crpix2 = p.at( 1 );
         }
         else
            console.warningln( "** Warning: WCSKeywords: Invalid PCL:AstrometricSolution:ReferenceImageCoordinates property value." );
      }

      if ( view.hasProperty( "PCL:AstrometricSolution:ReferenceNativeCoordinates" ) )
      {
         let p = view.propertyValue( "PCL:AstrometricSolution:ReferenceNativeCoordinates" );
         if ( (p instanceof Vector) && p.length >= 2 )
         {
            this.pv1_1 = p.at( 0 );
            this.pv1_2 = p.at( 1 );
         }
         else
            console.warningln( "** Warning: WCSKeywords: Invalid PCL:AstrometricSolution:ReferenceNativeCoordinates property value." );
      }

      if ( view.hasProperty( "PCL:AstrometricSolution:CelestialPoleNativeCoordinates" ) )
      {
         let p = view.propertyValue( "PCL:AstrometricSolution:CelestialPoleNativeCoordinates" );
         if ( (p instanceof Vector) && p.length >= 2 )
         {
            this.lonpole = p.at( 0 );
            this.latpole = p.at( 1 );
         }
         else
            console.warningln( "** Warning: WCSKeywords: Invalid PCL:AstrometricSolution:CelestialPoleNativeCoordinates property value." );
      }

      if ( view.hasProperty( "PCL:AstrometricSolution:LinearTransformationMatrix" ) )
      {
         let L = view.propertyValue( "PCL:AstrometricSolution:LinearTransformationMatrix" );
         if ( (L instanceof Matrix) && L.rows == 2 && L.columns == 2 )
         {
            this.cd1_1 = L.at( 0, 0 );
            this.cd1_2 = L.at( 0, 1 );
            this.cd2_1 = L.at( 1, 0 );
            this.cd2_2 = L.at( 1, 1 );
         }
         else
            console.warningln( "** Warning: WCSKeywords: Invalid PCL:AstrometricSolution:LinearTransformationMatrix property value." );
      }

      this.fromFITS = this.cd1_1 === null;

      /*
       * Standard WCS FITS keywords
       */
      let keywords = window.keywords;
      for ( let i = 0; i < keywords.length; ++i )
      {
         let name = keywords[i].name;
         let value = keywords[i].strippedValue;
         if ( this.ctype1 === null && name == "CTYPE1" )
            this.ctype1 = "'" + value + "'";
         else if ( this.ctype2 === null && name == "CTYPE2" )
            this.ctype2 = "'" + value + "'";
         else if ( this.crval1 === null && name == "CRVAL1" )
            this.crval1 = parseFloat( value );
         else if ( this.crval2 === null && name == "CRVAL2" )
            this.crval2 = parseFloat( value );
         else if ( this.crpix1 === null && name == "CRPIX1" )
            this.crpix1 = parseFloat( value );
         else if ( this.crpix2 === null && name == "CRPIX2" )
            this.crpix2 = parseFloat( value );
         else if ( this.cd1_1 === null && name == "CD1_1" )
            this.cd1_1 = parseFloat( value );
         else if ( this.cd1_2 === null && name == "CD1_2" )
            this.cd1_2 = parseFloat( value );
         else if ( this.cd2_1 === null && name == "CD2_1" )
            this.cd2_1 = parseFloat( value );
         else if ( this.cd2_2 === null && name == "CD2_2" )
            this.cd2_2 = parseFloat( value );
         else if ( this.pv1_1 === null && name == "PV1_1" )
            this.pv1_1 = parseFloat( value );
         else if ( this.pv1_2 === null && name == "PV1_2" )
            this.pv1_2 = parseFloat( value );
         else if ( this.lonpole === null && (name == "PV1_3" || name == "LONPOLE") )
            this.lonpole = parseFloat( value );
         else if ( this.latpole === null && (name == "PV1_4" || name == "LATPOLE") )
            this.latpole = parseFloat( value );
         // AIPS keywords
         else if ( name == "CDELT1" )
            this.cdelt1 = parseFloat( value );
         else if ( name == "CDELT2" )
            this.cdelt2 = parseFloat( value );
         else if ( name == "CROTA1" )
            this.crota1 = parseFloat( value );
         else if ( name == "CROTA2" )
            this.crota2 = parseFloat( value );
      }

      /*
       * Primary optional FITS keywords.
       */
      for ( let i = 0; i < keywords.length; ++i )
      {
         let name = keywords[i].name;
         let value = keywords[i].strippedValue;

         if ( this.radesys === null && name == "RADESYS" )
         {
            /*
             * Reference system of celestial coordinates.
             */
            this.radesys = value;
         }
         else if ( this.objctra === null && name == "RA" )
         {
            /*
             * The RA keyword value can be either a complex angular
             * representation in hours (hh mm ss.sss) or a scalar in degrees
             * ([+|-]ddd.dddddd).
             */
            if ( value.indexOf( ' ' ) > 0 || value.indexOf( ':' ) > 0 )
            {
               let angle = DMSangle.FromString( value, 0, 24 );
               if ( angle != null )
                  this.objctra = 15*angle.GetValue();
            }
            else
               this.objctra = parseFloat( value );
         }
         else if ( this.objctdec === null && name == "DEC" )
         {
            /*
             * The DEC keyword value can be either a complex angular
             * representation in degrees ([+|-]dd mm ss.sss) or a scalar
             * ([+|-]ddd.dddddd), also in degrees.
             */
            if ( value.indexOf( ' ' ) > 0 || value.indexOf( ':' ) > 0 )
            {
               let angle = DMSangle.FromString( value, 0, 90 );
               if ( angle != null )
                  this.objctdec = angle.GetValue();
            }
            else
               this.objctdec = parseFloat( value );
         }
         else if ( this.epoch === null && name == "DATE-BEG" )
         {
            let date = this.ExtractDate( value );
            if ( date )
               this.epoch = date;
         }
         else if ( this.endTime === null && name == "DATE-END" )
         {
            let date = this.ExtractDate( value );
            if ( date )
               this.endTime = date;
         }
         else if ( this.longobs === null && name == "OBSGEO-L" )
         {
            /*
             * The OBSGEO-L keyword value can be either a complex angular
             * representation in degrees ([+|-]ddd mm ss.sss) or a scalar in
             * degrees ([+|-]ddd.dddddd).
             */
            if ( value.indexOf( ' ' ) > 0 || value.indexOf( ':' ) > 0 )
            {
               let angle = DMSangle.FromString( value, 0, 180 ); // positive East
               if ( angle != null )
                  this.longobs = angle.GetValue();
            }
            else
               this.longobs = parseFloat( value );
         }
         else if ( this.latobs === null && name == "OBSGEO-B" )
         {
            /*
             * The OBSGEO-B keyword value can be either a complex angular
             * representation in degrees ([+|-]dd mm ss.sss) or a scalar in
             * degrees ([+|-]dd.dddddd).
             */
            if ( value.indexOf( ' ' ) > 0 || value.indexOf( ':' ) > 0 )
            {
               let angle = DMSangle.FromString( value, 0, 90 ); // positive North
               if ( angle != null )
                  this.latobs = angle.GetValue();
            }
            else
               this.latobs = parseFloat( value );
         }
         else if ( this.altobs === null && name == "OBSGEO-H" )
            this.altobs = parseFloat( value );
         else if ( this.focallen === null && name == "FOCALLEN" )
            this.focallen = parseFloat( value );
         else if ( this.xpixsz === null && name == "XPIXSZ" )
            this.xpixsz = parseFloat( value );
         else if ( expTime === null && name == "EXPTIME" )
            expTime = parseFloat( value );
      }

      /*
       * Secondary optional FITS keywords, supported for compatibility with
       * some applications.
       */
      for ( let i = 0; i < keywords.length; ++i )
      {
         let name = keywords[i].name;
         let value = keywords[i].strippedValue;

         if ( this.objctra == null && name == "OBJCTRA" )
         {
            /*
             * The OBJCTRA keyword value must be a complex angular
             * representation in hours (hh mm ss.sss)
             */
            let angle = DMSangle.FromString( value, 0, 24 );
            if ( angle != null )
               this.objctra = 15*angle.GetValue();
         }
         else if ( this.objctdec == null && name == "OBJCTDEC" )
         {
            /*
             * The OBJCTDEC keyword value must be a complex angular
             * representation in degrees ([+|-]dd mm ss.ss)
             */
            let angle = DMSangle.FromString( value, 0, 90 );
            if ( angle != null )
               this.objctdec = angle.GetValue();
         }
         else if ( this.epoch == null && name == "DATE-OBS" )
         {
            let date = this.ExtractDate( value );
            if ( date )
               this.epoch = date;
         }
         else if ( this.longobs == null && (name == "LONG-OBS" || name == "SITELONG") )
         {
            /*
             * The LONG-OBS or SITELONG keyword value must be a complex angular
             * representation in degrees ([+|-]ddd mm ss.sss).
             */
            let angle = DMSangle.FromString( value, 0, 180 ); // positive East
            this.longobs = (angle != null) ? angle.GetValue() : parseFloat( value );
         }
         else if ( this.latobs == null && (name == "LAT-OBS" || name == "SITELAT") )
         {
            /*
             * The LAT-OBS or SITELAT keyword value must be a complex angular
             * representation in degrees ([+|-]dd mm ss.sss).
             */
            let angle = DMSangle.FromString( value, 0, 90 ); // positive North
            this.latobs = (angle != null) ? angle.GetValue() : parseFloat( value );
         }
         else if ( this.altobs == null && (name == "ALT-OBS" || name == "SITEELEV") )
         {
            this.altobs = parseFloat( value );
         }
         else if ( this.xpixsz == null && name == "PIXSIZE" )
            this.xpixsz = parseFloat( value );
         else if ( expTime == null && name == "EXPOSURE" )
            expTime = parseFloat( value );
      }

      if ( this.epoch == null )
      {
         // Don't let funny FITS header data fool us.
         this.endTime = this.observationTime = null;
      }
      else
      {
         let endTime = null;

         /*
          * If Observation:Time:End (DATE-END) is not available, try to
          * approximate it from the observation start time and exposure time.
          */
         if ( this.endTime == null )
         {
            if ( expTime != null )
               endTime = this.epoch + expTime/86400;
         }
         else
         {
            // For mental sanity.
            if ( this.endTime < this.epoch )
            {
               let t = this.epoch;
               this.epoch = this.endTime;
               this.endTime = t;
            }
            endTime = this.endTime;
         }

         /*
          * Try to synthesize the observation middle time. This is the time
          * point we should use for all solar system ephemeris calculations.
          */
         if ( endTime != null )
            this.observationTime = this.epoch + (endTime - this.epoch)/2;
         else
            this.observationTime = this.epoch;
      }
   };

   this.ExtractDate = function( timeStr )
   {
      let match = timeStr.match("'?([0-9]*)-([0-9]*)-([0-9]*)(T([0-9]*):([0-9]*):([0-9]*(\.[0-9]*)?))?'?");
      if( match == null)
         return null;
      let year = parseInt( match[1], 10 );
      let month = parseInt( match[2], 10 );
      let day = parseInt( match[3], 10 );
      let hour = match[5] ? parseInt( match[5], 10 ) : 0;
      let min = match[6] ? parseInt( match[6], 10 ) : 0;
      let sec = match[7] ? parseFloat( match[7] ) : 0;
      let frac = (hour + min/60 + sec/3600)/24;

      return Math.calendarTimeToJD( year, month, day, frac );
   };

   this.CreateProjection = function()
   {
      let ptype1 = this.ctype1.substr( 6, 3 );
      let ptype2 = this.ctype2.substr( 6, 3 );
      if ( ptype1 != ptype2 )
         throw "Invalid/unsupported WCS coordinates: Axes with different projections";
      if ( ptype1 == "TAN" )
         return new Gnomonic( 180/Math.PI, this.crval1, this.crval2 );
      let proj = null;
      if ( ptype1 == "MER" )
         proj = new ProjectionMercator();
      else if ( ptype1 == "STG" )
         proj = new ProjectionStereographic();
      else if ( ptype1 == "CAR" )
         proj = new ProjectionPlateCarree();
      else if ( ptype1 == "ZEA" )
         proj = new ProjectionZenithalEqualArea();
      else if ( ptype1 == "AIT" )
         proj = new ProjectionHammerAitoff();
      else if ( ptype1 == "SIN" )
         proj = new ProjectionOrthographic();
      else
         throw "Invalid WCS coordinates: Unsupported projection '" + ptype1 + "'";
      proj.InitFromWCS( this );
      return proj;
   };
}

// ----------------------------------------------------------------------------

function DMath()
{
}

DMath.DEG2RAD = Math.PI / 180;
DMath.RAD2DEG = 180 / Math.PI;

DMath.sin = function( x )
{
   return Math.sin( x * this.DEG2RAD );
};

DMath.cos = function( x )
{
   return Math.cos( x * this.DEG2RAD );
};

DMath.tan = function( x )
{
   return Math.tan( x * this.DEG2RAD );
};

DMath.asin = function( x )
{
   return Math.asin( x ) * this.RAD2DEG;
};

DMath.acos = function( x )
{
   return Math.acos( x ) * this.RAD2DEG;
};

DMath.atan = function( x )
{
   return Math.atan( x ) * this.RAD2DEG;
};

DMath.atan2 = function( y, x )
{
   return Math.atan2( y, x ) * this.RAD2DEG;
};

// ----------------------------------------------------------------------------

/*
 * ImageMetadata: Metadata of an image including an astrometric solution.
 */
function ImageMetadata( module, scalingFactor )
{
   this.__base__ = ObjectWithSettings;
   this.__base__(
      module ? module : SETTINGS_MODULE,
      "metadata",
      new Array(
         ["focal", DataType_Double],
         ["useFocal", DataType_Boolean],
         ["xpixsz", DataType_Float],
         // ["ypixsz", DataType_Float],
         ["resolution", DataType_Double],
         ["referenceSystem", DataType_String],
         ["ra", DataType_Double],
         ["dec", DataType_Double],
         ["epoch", DataType_Double],
         ["observationTime", DataType_Double],
         ["topocentric", DataType_Boolean],
         ["obsLongitude", DataType_Double],
         ["obsLatitude", DataType_Double],
         ["obsHeight", DataType_Double]
      )
   );

   this.focal = 1000;
   this.useFocal = true;
   this.xpixsz = 7.4;
   // this.ypixsz = 7.4;
   this.resolution = null;
   this.referenceSystem = "ICRS";
   this.ra = null;
   this.dec = null;
   this.epoch = null; // ### TODO: Rename to startTime
   this.endTime = null;
   this.observationTime = null;
   this.topocentric = false;
   this.obsLongitude = null;
   this.obsLatitude = null;
   this.obsHeight = null;
   this.scalingFactor = scalingFactor ? scalingFactor : 1;
   this.sourceImageWindow = null;

   this.Clone = function()
   {
      let clone = new ImageMetadata();
      for ( let field in this )
         clone[field] = this[field];
      return clone;
   };

   this.ExtractMetadata = function( window )
   {
      this.ref_I_G_linear = null;
      this.ref_I_G = null;
      this.ref_G_I = null;

      if ( window === null || window === undefined || window.isNull )
         return;

      let wcs = new WCSKeywords();
      wcs.Read( window );

      this.referenceSystem = wcs.radesys ? wcs.radesys : "ICRS";
      this.epoch = wcs.epoch;
      this.endTime = wcs.endTime;
      this.observationTime = wcs.observationTime;

      if ( wcs.longobs != null && wcs.latobs != null )
      {
         this.obsLongitude = wcs.longobs;
         this.obsLatitude = wcs.latobs;
         this.obsHeight = wcs.altobs;
         this.topocentric = true;
      }
      else
      {
         this.obsLongitude = this.obsLatitude = this.obsHeight = null;
         this.topocentric = false;
      }

      if ( wcs.xpixsz )
         this.xpixsz = wcs.xpixsz;

      this.sourceImageWindow = window;
      this.width = window.mainView.image.width;
      this.height = window.mainView.image.height;
      this.scaledWidth = Math.roundTo( this.width * this.scalingFactor, 2 );
      this.scaledHeight = Math.roundTo( this.height * this.scalingFactor, 2 );

      if ( wcs.ctype1 && wcs.ctype1.substr( 0, 5 ) == "'RA--" &&
           wcs.ctype2 && wcs.ctype2.substr( 0, 5 ) == "'DEC-" &&
           wcs.crpix1 != null && wcs.crpix2 != null && wcs.crval1 != null && wcs.crval2 != null )
      {
         try
         {
            this.projection = wcs.CreateProjection();

            let ref_F_G = null;
            let bottomUp = true;
            if ( wcs.cd1_1 != null && wcs.cd1_2 != null && wcs.cd2_1 != null && wcs.cd2_2 != null )
            {
               ref_F_G = new Matrix(
                  wcs.cd1_1, wcs.cd1_2, -wcs.cd1_1*wcs.crpix1 - wcs.cd1_2*wcs.crpix2,
                  wcs.cd2_1, wcs.cd2_2, -wcs.cd2_1*wcs.crpix1 - wcs.cd2_2*wcs.crpix2,
                  0, 0, 1 );

               if ( wcs.fromFITS )
               {
                  /*
                   * See "Representations of celestial coordinates in FITS", Sect. 6.2.
                   */
                  let rot1;
                  if ( wcs.cd2_1 > 0 )
                     rot1 = Math.atan2( wcs.cd2_1, wcs.cd1_1 );
                  else if ( wcs.cd2_1 < 0 )
                     rot1 = Math.atan2( -wcs.cd2_1, -wcs.cd1_1 );
                  else
                     rot1 = 0;

                  let rot2;
                  if ( wcs.cd1_2 > 0 )
                     rot2 = Math.atan2( wcs.cd1_2, -wcs.cd2_2 );
                  else if ( wcs.cd1_2 < 0 )
                     rot2 = Math.atan2( -wcs.cd1_2, wcs.cd2_2 );
                  else
                     rot2 = 0;

                  let rot = (rot1 + rot2)/2;
                  let cdelt2 = (Math.abs( Math.cos( rot ) ) > Math.abs( Math.sin( rot ) )) ? wcs.cd2_2/Math.cos( rot ) : -wcs.cd1_2/Math.sin( rot );
                  if ( cdelt2 < 0 )
                     bottomUp = false;
               }
            }
            else if ( wcs.cdelt1 != null && wcs.cdelt2 != null /*&& crota2 != null*/ )
            {
               if ( wcs.crota2 == null )
                  wcs.crota2 = 0;
               let rot = Math.rad( wcs.crota2 );
               let cd1_1 = wcs.cdelt1 * Math.cos( rot );
               let cd1_2 = -wcs.cdelt2 * Math.sin( rot );
               let cd2_1 = wcs.cdelt1 * Math.sin( rot );
               let cd2_2 = wcs.cdelt2 * Math.cos( rot );
               ref_F_G = new Matrix(
                  cd1_1, cd1_2, -cd1_1*wcs.crpix1 - cd1_2*wcs.crpix2,
                  cd2_1, cd2_2, -cd2_1*wcs.crpix1 - cd2_2*wcs.crpix2,
                  0, 0, 1 );
               if ( wcs.fromFITS )
                  if ( wcs.cdelt2 < 0 )
                     bottomUp = false;
            }

            if ( ref_F_G != null )
            {
               let splineWT = window.mainView.propertyValue( "PCL:AstrometricSolution:SplineWorldTransformation" );
               if ( !splineWT || !(splineWT instanceof ByteArray) )
                  splineWT = window.mainView.propertyValue( "Transformation_ImageToProjection" ); // be compatible with core < 1.8.9-2
               if ( splineWT && (splineWT instanceof ByteArray) )
               {
                  this.loadControlPoints( splineWT );
               }
               else
               {
                  if ( wcs.fromFITS )
                  {
                     let ref_F_I;
                     if ( bottomUp )
                        ref_F_I = new Matrix( 1,  0,            -0.5,
                                              0, -1, this.height+0.5,
                                              0,  0,             1 );
                     else
                        ref_F_I = new Matrix( 1,  0,            -0.5,
                                              0,  1,            -0.5,
                                              0,  0,             1 );
                     this.ref_I_G_linear = ref_F_G.mul( ref_F_I.inverse() );
                  }
                  else
                     this.ref_I_G_linear = ref_F_G;

                  this.ref_I_G = this.ref_I_G_linear;
                  this.ref_G_I = this.ref_I_G.inverse();
               }

               let centerG = this.ref_I_G.Apply( new Point( this.width/2, this.height/2 ) );
               let center = this.projection.Inverse( centerG );
               this.ra = center.x;
               this.dec = center.y;

               let resx = Math.sqrt( ref_F_G.at( 0, 0 )*ref_F_G.at( 0, 0 ) + ref_F_G.at( 0, 1 )*ref_F_G.at( 0, 1 ) );
               let resy = Math.sqrt( ref_F_G.at( 1, 0 )*ref_F_G.at( 1, 0 ) + ref_F_G.at( 1, 1 )*ref_F_G.at( 1, 1 ) );
               this.resolution = (resx + resy)/2;
               this.useFocal = false;
               if ( this.xpixsz > 0 )
                  this.focal = this.FocalFromResolution( this.resolution );
            }
         }
         catch ( ex )
         {
            console.writeln( ex );
         }
      }

      if ( this.ref_I_G == null )
      {
         if ( wcs.objctra != null )
            this.ra = wcs.objctra;
         if ( wcs.objctdec != null )
            this.dec = wcs.objctdec;
         if ( wcs.focallen > 0 )
         {
            this.focal = wcs.focallen;
            this.useFocal = true;
         }
         if ( this.useFocal && this.xpixsz > 0 )
            this.resolution = this.ResolutionFromFocal( this.focal );
      }
   };

   this.GetDateString = function( jd )
   {
      let dateArray = Math.jdToCalendarTime( jd );
      let hours = Math.trunc( dateArray[3]*24 );
      let min = Math.trunc( dateArray[3]*24*60 ) - hours*60;
      let sec = dateArray[3]*24*3600 - hours*3600 - min*60;
      return format( "%04d-%02d-%02dT%02d:%02d:%0.2f", dateArray[0], dateArray[1], dateArray[2], hours, min, sec );
   };

   this.ResolutionFromFocal = function( focal )
   {
      return (focal > 0) ? this.xpixsz/focal*0.18/Math.PI : 0;
   };

   this.FocalFromResolution = function( resolution )
   {
      return (resolution > 0) ? this.xpixsz/resolution*0.18/Math.PI : 0;
   };

   this.GetWCSvalues = function()
   {
      let ref_F_I = new Matrix(
         1,  0,              -0.5,
         0, -1, this.height + 0.5,
         0,  0,               1 );
      let ref_F_G;
      if ( this.ref_I_G instanceof ReferSpline )
         ref_F_G = this.ref_I_G_linear.mul( ref_F_I );
      else
      {
         if ( this.ref_I_G.ToLinearMatrix )
            ref_F_G = this.ref_I_G.ToLinearMatrix().mul( ref_F_I );
         else
            ref_F_G = this.ref_I_G.mul( ref_F_I );
      }

      let wcs = this.projection.GetWCS();

      wcs.cd1_1 = ref_F_G.at( 0, 0 );
      wcs.cd1_2 = ref_F_G.at( 0, 1 );
      wcs.cd2_1 = ref_F_G.at( 1, 0 );
      wcs.cd2_2 = ref_F_G.at( 1, 1 );

      let orgF = ref_F_G.inverse().Apply( new Point( 0, 0 ) );
      wcs.crpix1 = orgF.x;
      wcs.crpix2 = orgF.y;

      // CDELT1, CDELT2 and CROTA2 are computed using the formulas
      // in section 6.2 of http://fits.gsfc.nasa.gov/fits_wcs.html
      // "Representations of celestial coordinates in FITS"

      let rot1;
      if ( wcs.cd2_1 > 0 )
         rot1 = Math.atan2( wcs.cd2_1, wcs.cd1_1 );
      else if ( wcs.cd2_1 < 0 )
         rot1 = Math.atan2( -wcs.cd2_1, -wcs.cd1_1 );
      else
         rot1 = 0;

      let rot2;
      if ( wcs.cd1_2 > 0 )
         rot2 = Math.atan2( wcs.cd1_2, -wcs.cd2_2 );
      else if ( wcs.cd1_2 < 0 )
         rot2 = Math.atan2( -wcs.cd1_2, wcs.cd2_2 );
      else
         rot2 = 0;

      let rot = (rot1 + rot2)/2;

      if ( Math.abs( Math.cos( rot ) ) > Math.abs( Math.sin( rot ) ) )
      {
         wcs.cdelt1 = wcs.cd1_1/Math.cos( rot );
         wcs.cdelt2 = wcs.cd2_2/Math.cos( rot );
      }
      else
      {
         wcs.cdelt1 = wcs.cd2_1/Math.sin( rot );
         wcs.cdelt2 = -wcs.cd1_2/Math.sin( rot );
      }

      wcs.crota1 = Math.deg( rot );
      wcs.crota2 = Math.deg( rot );

      return wcs;
   };

   this.GetRotation = function()
   {
      if ( this.ref_I_G_linear )
      {
         let ref = this.ref_I_G_linear ? this.ref_I_G_linear : this.ref_I_G;
         let det = ref.at( 0, 1 )*ref.at( 1, 0 ) - ref.at( 0, 0 )*ref.at( 1, 1 );
         let rot = Math.deg( Math.atan2( ref.at( 0, 0 ) + ref.at( 0, 1 ),
                                         ref.at( 1, 0 ) + ref.at( 1, 1 ) ) ) + 135;
         if ( det > 0 )
            rot = -90 - rot;
         if ( rot < -180 )
            rot += 360;
         if ( rot > 180 )
            rot -= 360;

         return [rot, det > 0];
      }

      return null;
   };

   this.SearchRadius = function()
   {
      let radius = Math.max( this.width, this.height )*this.resolution;

      if ( this.ref_I_G && radius < 100 )
      {
         let r1 = this.DistanceI( new Point( this.width/2, this.height/2 ),
                                  new Point( 0,            0             ), true/*unscaled*/ );
         let r2 = this.DistanceI( new Point( this.width/2, this.height/2 ),
                                  new Point( this.width,   0             ), true/*unscaled*/ );
         let r3 = this.DistanceI( new Point( this.width/2, this.height/2 ),
                                  new Point( 0,            this.height   ), true/*unscaled*/ );
         let r4 = this.DistanceI( new Point( this.width/2, this.height/2 ),
                                  new Point( this.width,   this.height   ), true/*unscaled*/ );
         if ( !r1 || !r2 || !r3 || !r4 )
            return 180;
         return Math.max( r1, r2, r3, r4 );
      }

      return radius;
   }

   this.ModifyKeyword = function( keywords, name, value, comment )
   {
      for ( let i = 0; i < keywords.length; ++i )
         if ( keywords[i].name == name )
         {
            keywords[i].value = value;
            if ( comment != null )
               keywords[i].comment = comment;
            return;
         }
      keywords.push( new FITSKeyword( name, value, (comment == null) ? "" : comment ) );
   };

   this.RemoveKeyword = function( keywords, name )
   {
      for ( let i = 0; i < keywords.length; ++i )
         if ( keywords[i].name == name )
         {
            keywords.splice( i, 1 );
            return;
         }
   };

   this.GetKeywordFloat = function( keywords, name, exception )
   {
      for ( let i = 0; i < keywords.length; ++i )
         if ( keywords[i].name == name )
            return parseFloat( keywords[i].value );
      if ( exception )
         throw format( "Keyword %ls not found", name );
      return null;
   };

   this.UpdateBasicKeywords = function( keywords )
   {
      if ( this.focal > 0 )
         this.ModifyKeyword( keywords, "FOCALLEN", format( "%.3f", this.focal ), "Focal Length (mm)" );
      else
         this.RemoveKeyword( keywords, "FOCALLEN" );

      if ( this.xpixsz > 0 )
      {
         this.ModifyKeyword( keywords, "XPIXSZ", format( "%.3f", this.xpixsz ), "Pixel size, X-axis (um)" );
         this.ModifyKeyword( keywords, "YPIXSZ", format( "%.3f", this.xpixsz ), "Pixel size, Y-axis (um)" );
         this.RemoveKeyword( keywords, "PIXSIZE" );
      }

      if ( this.ra != null )
      {
         this.ModifyKeyword( keywords, "RA", format( "%.16f", this.ra ), "Right ascension of the center of the image (deg)" );
         this.RemoveKeyword( keywords, "OBJCTRA" );
      }

      if ( this.dec != null )
      {
         this.ModifyKeyword( keywords, "DEC", format( "%.16f", this.dec ), "Declination of the center of the image (deg)" );
         this.RemoveKeyword( keywords, "OBJCTDEC" );
      }

      if ( this.epoch != null )
      {
         this.ModifyKeyword( keywords, "DATE-OBS", this.GetDateString( this.epoch ), "Observation start time (UTC)" );
         this.RemoveKeyword( keywords, "DATE-BEG" );
      }

      if ( this.endTime != null )
         this.ModifyKeyword( keywords, "DATE-END", this.GetDateString( this.endTime ), "Observation end time (UTC)" );

      if ( this.obsLongitude != null )
      {
         this.ModifyKeyword( keywords, "OBSGEO-L", format( "%.7f", this.obsLongitude ), "Geodetic longitude (deg)" );
         this.RemoveKeyword( keywords, "LONG-OBS" );
         this.RemoveKeyword( keywords, "SITELONG" );
      }

      if ( this.obsLatitude != null )
      {
         this.ModifyKeyword( keywords, "OBSGEO-B", format( "%.7f", this.obsLatitude ), "Geodetic latitude (deg)" );
         this.RemoveKeyword( keywords, "LAT-OBS" );
         this.RemoveKeyword( keywords, "SITELAT" );
      }

      if ( this.obsHeight != null )
      {
         this.ModifyKeyword( keywords, "OBSGEO-H", format( "%.0f", this.obsHeight ), "Geodetic elevation (m)" );
         this.RemoveKeyword( keywords, "ALT-OBS" );
         this.RemoveKeyword( keywords, "SITEELEV" );
      }
   };

   this.UpdateWCSKeywords = function( keywords, generate )
   {
      this.RemoveKeyword( keywords, "RADESYS" );
      this.RemoveKeyword( keywords, "EQUINOX" );
      this.RemoveKeyword( keywords, "EPOCH" );
      this.RemoveKeyword( keywords, "CTYPE1" );
      this.RemoveKeyword( keywords, "CTYPE2" );
      this.RemoveKeyword( keywords, "CRVAL1" );
      this.RemoveKeyword( keywords, "CRVAL2" );
      this.RemoveKeyword( keywords, "CRPIX1" );
      this.RemoveKeyword( keywords, "CRPIX2" );
      this.RemoveKeyword( keywords, "CD1_1" );
      this.RemoveKeyword( keywords, "CD1_2" );
      this.RemoveKeyword( keywords, "CD2_1" );
      this.RemoveKeyword( keywords, "CD2_2" );
      this.RemoveKeyword( keywords, "PC1_1" );
      this.RemoveKeyword( keywords, "PC1_2" );
      this.RemoveKeyword( keywords, "PC2_1" );
      this.RemoveKeyword( keywords, "PC2_2" );
      this.RemoveKeyword( keywords, "PV1_1" );
      this.RemoveKeyword( keywords, "PV1_2" );
      this.RemoveKeyword( keywords, "PV1_3" );
      this.RemoveKeyword( keywords, "PV1_4" );
      this.RemoveKeyword( keywords, "LONPOLE" );
      this.RemoveKeyword( keywords, "LATPOLE" );
      this.RemoveKeyword( keywords, "CDELT1" );
      this.RemoveKeyword( keywords, "CDELT2" );
      this.RemoveKeyword( keywords, "CROTA1" );
      this.RemoveKeyword( keywords, "CROTA2" );

      /*
       * Remove obsolete FITS keywords generated by plate solving scripts and
       * processes before core version 1.8.9-2.
       */
      this.RemoveKeyword( keywords, "POLYNDEG" );
      this.RemoveKeyword( keywords, "REFSPLIN" );
      this.RemoveKeyword( keywords, "REFSPLINE" ); // N.B. 9-char keyword name written by old versions, not FITS-compliant.

      if ( generate )
      {
         let wcs = this.GetWCSvalues();

         this.RemoveKeyword( keywords, "EQUINOX" );  // See Calabretta and Greisen, Section 3.1
         this.RemoveKeyword( keywords, "EPOCH" );    // See FITS standard 4.0, Section 8.3

         this.ModifyKeyword( keywords, "RADESYS",    "'" + this.referenceSystem + "'", "Reference system of celestial coordinates" );

         this.ModifyKeyword( keywords, "CTYPE1",     wcs.ctype1,                       "Axis1 projection: "+ this.projection.name );
         this.ModifyKeyword( keywords, "CTYPE2",     wcs.ctype2,                       "Axis2 projection: "+ this.projection.name );

         this.ModifyKeyword( keywords, "CRPIX1",     format( "%.8f", wcs.crpix1 ),     "Axis1 reference pixel" );
         this.ModifyKeyword( keywords, "CRPIX2",     format( "%.8f", wcs.crpix2 ),     "Axis2 reference pixel" );

         if ( wcs.crval1 != null )
            this.ModifyKeyword( keywords, "CRVAL1",  format( "%.16f", wcs.crval1 ),    "Axis1 reference value" );
         if ( wcs.crval2 != null )
            this.ModifyKeyword( keywords, "CRVAL2",  format( "%.16f", wcs.crval2 ),    "Axis2 reference value" );

         if ( wcs.pv1_1 != null )
            this.ModifyKeyword( keywords, "PV1_1",   format( "%.16f", wcs.pv1_1 ),     "Native longitude of the reference point" );
         if ( wcs.pv1_2 != null )
            this.ModifyKeyword( keywords, "PV1_2",   format( "%.16f", wcs.pv1_2 ),     "Native latitude of the reference point" );

         if ( wcs.lonpole != null )
            this.ModifyKeyword( keywords, "LONPOLE", format( "%.16f", wcs.lonpole ),   "Longitude of the celestial pole" );
         if ( wcs.latpole != null )
            this.ModifyKeyword( keywords, "LATPOLE", format( "%.16f", wcs.latpole ),   "Latitude of the celestial pole" );

         this.RemoveKeyword( keywords, "PC1_1" );
         this.RemoveKeyword( keywords, "PC1_2" );
         this.RemoveKeyword( keywords, "PC2_1" );
         this.RemoveKeyword( keywords, "PC2_2" );

         this.ModifyKeyword( keywords, "CD1_1",      format( "%.16f", wcs.cd1_1 ),     "Scale matrix (1,1)" );
         this.ModifyKeyword( keywords, "CD1_2",      format( "%.16f", wcs.cd1_2 ),     "Scale matrix (1,2)" );
         this.ModifyKeyword( keywords, "CD2_1",      format( "%.16f", wcs.cd2_1 ),     "Scale matrix (2,1)" );
         this.ModifyKeyword( keywords, "CD2_2",      format( "%.16f", wcs.cd2_2 ),     "Scale matrix (2,2)" );

         // AIPS keywords
         this.ModifyKeyword( keywords, "CDELT1",     format( "%.16f", wcs.cdelt1 ),    "Axis1 scale" );
         this.ModifyKeyword( keywords, "CDELT2",     format( "%.16f", wcs.cdelt2 ),    "Axis2 scale" );
         this.ModifyKeyword( keywords, "CROTA1",     format( "%.16f", wcs.crota1 ),    "Axis1 rotation angle (deg)" );
         this.ModifyKeyword( keywords, "CROTA2",     format( "%.16f", wcs.crota2 ),    "Axis2 rotation angle (deg)" );
      }
   };

   this.SaveKeywords = function( imageWindow, beginProcess )
   {
      console.writeln( "<end><cbr>Saving keywords..." );
      if ( beginProcess )
         imageWindow.mainView.beginProcess( UndoFlag_Keywords );

      let keywords = imageWindow.keywords;
      this.UpdateBasicKeywords( keywords );
      this.UpdateWCSKeywords( keywords );
      imageWindow.keywords = keywords;

      if ( beginProcess )
         imageWindow.mainView.endProcess();
   };

   this.ModifyProperty = function( view, identifier, value, type  )
   {
      view.setPropertyValue( identifier, value, type, PropertyAttribute_Storable | PropertyAttribute_Permanent );
   };

   this.RemoveProperty = function( view, identifier )
   {
      view.deleteProperty( identifier );
   };

   this.SaveProperties = function( imageWindow, creatorModule, catalogName )
   {
      console.writeln( "<end><cbr>Saving properties..." );

      let view = imageWindow.mainView;

      if ( this.focal > 0 )
         this.ModifyProperty( view, "Instrument:Telescope:FocalLength", Math.roundTo( this.focal/1000, 6 ), PropertyType_Float64 );
      else
         this.RemoveProperty( view, "Instrument:Telescope:FocalLength" );

      if ( this.xpixsz > 0 )
      {
         this.ModifyProperty( view, "Instrument:Sensor:XPixelSize", Math.roundTo( this.xpixsz, 3 ), PropertyType_Float64 );
         this.ModifyProperty( view, "Instrument:Sensor:YPixelSize", Math.roundTo( this.xpixsz, 3 ), PropertyType_Float64 );
      }

      if ( this.epoch != null )
         this.ModifyProperty( view, "Observation:Time:Start", this.epoch, PropertyType_TimePoint );

      if ( this.endTime != null )
         this.ModifyProperty( view, "Observation:Time:End", this.endTime, PropertyType_TimePoint );

      if ( this.obsLongitude != null && this.obsLatitude != null )
      {
         this.ModifyProperty( view, "Observation:Location:Longitude", Math.roundTo( this.obsLongitude, 6 ), PropertyType_Float64 );
         this.ModifyProperty( view, "Observation:Location:Latitude", Math.roundTo( this.obsLatitude, 6 ), PropertyType_Float64 );
         if ( this.obsHeight != null )
            this.ModifyProperty( view, "Observation:Location:Elevation", Math.round( this.obsHeight ), PropertyType_Float64 );
      }

      let pRD = this.Convert_I_RD( new Point( view.image.width/2, view.image.height/2 ), true/*unscaled*/ );
      if ( pRD != null )
      {
         this.ModifyProperty( view, "Observation:Center:RA", pRD.x, PropertyType_Float64 );
         this.ModifyProperty( view, "Observation:Center:Dec", pRD.y, PropertyType_Float64 );
         this.ModifyProperty( view, "Observation:CelestialReferenceSystem", this.referenceSystem, PropertyType_String8 );
         this.ModifyProperty( view, "Observation:Equinox", 2000.0, PropertyType_Float64 );
         // The default reference point is the geometric center of the image.
         this.RemoveProperty( view, "Observation:Center:X" );
         this.RemoveProperty( view, "Observation:Center:Y" );
      }

      this.ModifyProperty( view, "PCL:AstrometricSolution:ProjectionSystem",
                           this.projection.identifier, PropertyType_String8 );

      let vC0 = new Vector( [Math.deg( this.projection.ra0 ), Math.deg( this.projection.dec0 )] );
      let pI0 = this.ref_I_G_linear.inverse().Apply( new Point( 0, 0 ) );
          pI0 = new Vector( [pI0.x, pI0.y] );
      this.ModifyProperty( view, "PCL:AstrometricSolution:ReferenceCelestialCoordinates",
                           vC0, PropertyType_F64Vector );
      this.ModifyProperty( view, "PCL:AstrometricSolution:ReferenceImageCoordinates",
                           pI0, PropertyType_F64Vector );

      let LT = new Matrix( 2, 2 );
      LT.at( 0, 0, this.ref_I_G_linear.at( 0, 0 ) );
      LT.at( 0, 1, this.ref_I_G_linear.at( 0, 1 ) );
      LT.at( 1, 0, this.ref_I_G_linear.at( 1, 0 ) );
      LT.at( 1, 1, this.ref_I_G_linear.at( 1, 1 ) );

      this.ModifyProperty( view, "PCL:AstrometricSolution:LinearTransformationMatrix",
                           LT, PropertyType_F64Matrix );

      let nlon = this.projection.phi0;
      let nlat = this.projection.theta0;

      let plon = ((vC0.at( 1 ) < nlat) ? 180 : 0) + nlon;
      if ( plon < -180 )
         plon += 360;
      else if ( plon > 180 )
         plon -= 360;
      let plat = 90;

      if ( this.projection.wcs )
      {
         if ( this.projection.wcs.pv1_1 != null )
            nlon = this.projection.wcs.pv1_1;
         if ( this.projection.wcs.pv1_2 != null )
            nlat = this.projection.wcs.pv1_2;
         if ( this.projection.wcs.lonpole != null )
            plon = this.projection.wcs.lonpole;
         if ( this.projection.wcs.latpole != null )
            plat = this.projection.wcs.latpole;
      }

      this.ModifyProperty( view, "PCL:AstrometricSolution:ReferenceNativeCoordinates",
                           new Vector( [nlon, nlat] ), PropertyType_F64Vector );
      this.ModifyProperty( view, "PCL:AstrometricSolution:CelestialPoleNativeCoordinates",
                           new Vector( [plon, plat] ), PropertyType_F64Vector );

      if ( this.controlPoints && (this.ref_I_G instanceof ReferSpline) )
         this.saveControlPoints( imageWindow );
      else
         this.RemoveProperty( view, "PCL:AstrometricSolution:SplineWorldTransformation" );

      // Remove old properties used in core versions < 1.8.9-2.
      this.RemoveProperty( view, "Transformation_ImageToProjection" );

      this.ModifyProperty( view, "PCL:AstrometricSolution:CreationTime", (new Date).toISOString(), PropertyType_TimePoint );
      this.ModifyProperty( view, "PCL:AstrometricSolution:CreatorOS", CoreApplication.platform, PropertyType_String );

      {
         let creatorApp = format( "PixInsight %s%d.%d.%d",
                                  CoreApplication.versionLE ? "LE " : "",
                                  CoreApplication.versionMajor,
                                  CoreApplication.versionMinor,
                                  CoreApplication.versionRelease );
         if ( CoreApplication.versionRevision != 0 )
            creatorApp += format( "-%d", CoreApplication.versionRevision );
         if ( CoreApplication.versionBeta != 0 )
            creatorApp += format( " %s%d", (CoreApplication.versionBeta < 0) ? "RC" : "beta ", Math.abs( CoreApplication.versionBeta ) );

         this.ModifyProperty( view, "PCL:AstrometricSolution:CreatorApplication", creatorApp, PropertyType_String );
      }

      if ( creatorModule )
         this.ModifyProperty( view, "PCL:AstrometricSolution:CreatorModule", creatorModule, PropertyType_String );

      if ( catalogName )
         this.ModifyProperty( view, "PCL:AstrometricSolution:Catalog", catalogName.replace( "(XPSD)", "" ).trim(), PropertyType_String );
   };

   this.saveControlPoints = function( imageWindow )
   {
      console.writeln( "<end><cbr>Saving control points..." );
      let lines = ["VERSION:1.2", "TYPE:SurfaceSpline"];
      lines.push( format( "ORDER:%d", this.ref_I_G.order ) );
      lines.push( format( "SMOOTHING:%.4f", this.ref_I_G.smoothing ) );
      lines.push( format( "SIMPLIFIER:%d", this.ref_I_G.simplify ? 1 : 0 ) );
      lines.push( format( "REJECTFRACTION:%.2f", this.ref_I_G.rejectFraction ) );
      lines.push( "CONTROLPOINTS:[" );
      for ( let i = 0; i < this.controlPoints.pI.length; ++i )
         if ( this.controlPoints.pI[i] && this.controlPoints.pG[i] )
         {
            if ( this.controlPoints.weights )
               lines.push( format( "%.16e;%.16e;%.16e;%.16e;%.16e",
                                   this.controlPoints.pI[i].x, this.controlPoints.pI[i].y,
                                   this.controlPoints.pG[i].x, this.controlPoints.pG[i].y,
                                   this.controlPoints.weights[i] ) );
            else
               lines.push( format( "%.16e;%.16e;%.16e;%.16e",
                                   this.controlPoints.pI[i].x, this.controlPoints.pI[i].y,
                                   this.controlPoints.pG[i].x, this.controlPoints.pG[i].y ) );
         }
      lines.push( "]" );

      this.ModifyProperty( imageWindow.mainView,
                           "PCL:AstrometricSolution:SplineWorldTransformation",
                           new ByteArray( lines.join( '\n' ) ),
                           PropertyType_ByteArray );

      console.writeln( format( "Saved %u control points.", this.controlPoints.pI.length ) );
   };

   this.loadControlPoints = function( byteArray )
   {
      console.writeln( "<end><cbr>Loading control points..." );
      let lines = byteArray.toString().split( "\n" );
      if ( lines.length == 0 )
         throw "Invalid coordinate transformation data.";
      let tokens = lines[0].split( ':' );
      if ( tokens.length != 2 || tokens[0] != "VERSION" )
         throw "Invalid coordinate transformation version data.";
      let version = tokens[1].trim();
      if ( version != "1" && version != "1.1" && version != "1.2" )
         throw "Unsupported coordinate transformation version '" + version + "'";

      let controlPoints = null, order = 2, smoothing = 0.01,
          simplify = true, rejectFraction = 0.10;

      for ( let i = 1; i < lines.length; ++i )
      {
         tokens = lines[i].split( ':' );
         if ( tokens.length != 2 )
            continue;
         switch ( tokens[0] )
         {
         case "ORDER":
            order = parseInt( tokens[1] );
            break;
         case "SMOOTHING":
            smoothing = parseFloat( tokens[1] );
            break;
         case "SIMPLIFIER":
            simplify = parseInt( tokens[1] ) != 0;
            break;
         case "REJECTFRACTION":
            rejectFraction = parseFloat( tokens[1] );
            break;
         case "CONTROLPOINTS":
            if ( tokens[1].trim() != '[' )
               throw "Invalid coordinate transformation control points.";
            i++;
            controlPoints = { pI:      [],
                              pG:      [],
                              weights: null };
            for ( ; i < lines.length && lines[i] != ']'; ++i )
            {
               let coords = lines[i].split( ';' );
               if ( coords.length < 4 )
                  throw "Invalid coordinate transformation control points.";
               if ( coords.length < 5 && controlPoints.weights != null )
                  throw "Invalid coordinate transformation control points.";
               if ( coords.length > 5 )
                  throw "Invalid coordinate transformation control points.";
               controlPoints.pI.push( new Point( parseFloat( coords[0] ), parseFloat( coords[1] ) ) );
               controlPoints.pG.push( new Point( parseFloat( coords[2] ), parseFloat( coords[3] ) ) );
               if ( coords.length == 5 )
               {
                  if ( controlPoints.weights == null )
                     controlPoints.weights = [];
                  controlPoints.weights.push( parseFloat( coords[4] ) );
               }
            }
            if ( controlPoints.weights && controlPoints.pI.length != controlPoints.weights.length )
               throw "Invalid coordinate transformation control points: Mismatched weights.";
            break;
         }
      }

      if ( controlPoints == null )
         throw "Invalid coordinate transformation: no control points were loaded.";
      this.controlPoints = controlPoints;
      this.ref_I_G_linear = Math.homography( controlPoints.pI, controlPoints.pG );
      this.ref_I_G = new ReferSpline( controlPoints.pI, controlPoints.pG, controlPoints.weights,
                                      order, smoothing,
                                      simplify, rejectFraction );
      this.ref_G_I = new ReferSpline( controlPoints.pG, controlPoints.pI, controlPoints.weights,
                                      order, smoothing,
                                      simplify, rejectFraction );

      console.writeln( format( "Loaded %u control points (metadata version %s).", controlPoints.pI.length, version ) );
   };

   this.RectExpand = function( r, p )
   {
      if ( p )
      {
         let ra0 = Math.deg( this.projection.ra0 );
         let x = p.x;
         if ( x < ra0 - 180 )
            x += 360;
         if ( x > ra0 + 180 )
            x -= 360;

         if ( r )
         {
            r.x0 = Math.min( r.x0, x );
            r.x1 = Math.max( r.x1, x );
            r.y0 = Math.min( r.y0, p.y, 90 );
            r.y1 = Math.max( r.y1, p.y, -90 );
         }
         else
            r = new Rect( x, p.y, x, p.y );
      }
      return r;
   };

   this.FindImageBounds = function()
   {
      let bounds = null;

      let numSteps = 32;
      let sx = this.width/(numSteps - 1);
      let sy = this.height/(numSteps - 1);
      for ( let y = 0; y < numSteps; ++y )
         for ( let x = 0; x < numSteps; ++x )
            bounds = this.RectExpand( bounds, this.Convert_I_RD( new Point( x*sx, y*sy ), true/*unscaled*/ ) );
      let ra0 = Math.deg( this.projection.ra0 );

      // Check North Pole
      let north_I = this.Convert_RD_I( new Point( ra0, 90 ), true/*unscaled*/ );
      if ( north_I
        && north_I.x >= 0
        && north_I.x < this.width
        && north_I.y >= 0
        && north_I.y < this.height )
      {
         bounds.x0 = 0;
         bounds.x1 = 360;
         bounds.y1 = +90;
      }

      // Check South Pole
      let south_I = this.Convert_RD_I( new Point( ra0, -90 ), true/*unscaled*/ );
      if ( south_I
        && south_I.x >= 0
        && south_I.x < this.width
        && south_I.y >= 0
        && south_I.y < this.height )
      {
         bounds.x0 = 0;
         bounds.x1 = 360;
         bounds.y0 = -90;
      }

      bounds.x0 /= 15;
      bounds.x1 /= 15;

      return bounds;
   };

   this.Convert_I_RD = function( pI, unscaled )
   {
      let spI = pI;
      if ( !unscaled )
      {
         spI.x /= this.scalingFactor;
         spI.y /= this.scalingFactor;
      }
      return this.projection.Inverse( this.ref_I_G.Apply( spI ) );
   };

   this.Convert_RD_I = function( pRD, unscaled )
   {
      let pG = this.projection.Direct( pRD );
      if ( pG )
      {
         let pI = this.ref_G_I.Apply( pG );
         if ( !unscaled )
         {
            pI.x *= this.scalingFactor;
            pI.y *= this.scalingFactor;
         }
         return pI;
      }
      return null;
   };

   this.Convert_RD_I_Points = function( pointsRD, unscaled )
   {
      let pointsG = [];
      for ( let i = 0; i < pointsRD.length; ++i )
      {
         let pG = this.projection.Direct( pointsRD[i] );
         if ( pG )
            pointsG.push( pG );
      }
      let pointsI = this.ref_G_I.ApplyToPoints( pointsG );
      if ( !unscaled )
         for ( let i = 0; i < pointsI.length; ++i )
            pointsI[i].mul( this.scalingFactor );
      return pointsI;
   };

   this.DistanceI = function( p1, p2, unscaled )
   {
      return ImageMetadata.Distance( this.Convert_I_RD( p1, unscaled ), this.Convert_I_RD( p2, unscaled ) );
   };

   this.CheckOscillation = function( pRD, pI )
   {
      let spI;
      if ( !pI )
         spI = this.Convert_RD_I( pRD, true/*unscaled*/ );
      else
         spI = new Point( pI.x/this.scalingFactor, pI.y/this.scalingFactor );
      let pG = this.projection.Direct( pRD );
      let pIl = this.ref_I_G_linear.inverse().Apply( pG );
      return (pIl.x - spI.x)*(pIl.x - spI.x) + (pIl.y - spI.y)*(pIl.y - spI.y) < this.width*this.height/4;
   };
}

ImageMetadata.prototype = new ObjectWithSettings;

ImageMetadata.Distance = function( cp1, cp2 )
{
   if ( !cp1 || !cp2 )
      return NaN;
   let dX = Math.abs( cp1.x - cp2.x );
   let cosX = DMath.cos( dX );
   let sinX = DMath.sin( dX );
   let cosY1 = DMath.cos( cp1.y );
   let cosY2 = DMath.cos( cp2.y );
   let sinY1 = DMath.sin( cp1.y );
   let sinY2 = DMath.sin( cp2.y );
   let K = cosY1*sinY2 - sinY1*cosY2*cosX;
   return DMath.atan2( Math.sqrt( cosY2*sinX*cosY2*sinX + K*K ),
                       sinY1*sinY2 + cosY1*cosY2*cosX );
};

ImageMetadata.DistanceFast = function( cp1, cp2 )
{
   if ( !cp1 || !cp2 )
      return NaN;
   return DMath.acos( DMath.sin( cp1.y ) * DMath.sin( cp2.y ) +
                      DMath.cos( cp1.y ) * DMath.cos( cp2.y ) * DMath.cos( cp1.x - cp2.x ) );
};

// ----------------------------------------------------------------------------

/*
 * DMSangle: Helper class to simplify the use of angles in DMS format.
 */
function DMSangle()
{
   this.deg = 0;
   this.min = 0;
   this.sec = 0;
   this.sign = 1;

   this.GetValue = function()
   {
      return this.sign*(this.deg + (this.min + this.sec/60)/60);
   };

   this.ToString = function( hours, precision )
   {
      if ( precision === undefined )
         precision = 2;
      if ( hours )
         ++precision;
      let secWidth = 2;
      if ( precision > 0 )
         secWidth += 1 + precision;
      let plus = hours ? "" : "+";
      if ( this.deg != null && this.min != null && this.sec != null && this.sign != null )
         return ((this.sign < 0) ? "-": plus) +
               format( "%02d %02d %0*.*f", this.deg, this.min, secWidth, precision, this.sec );
      return "<* invalid *>";
   };
}

DMSangle.FromString = function( coordStr, mindeg, maxdeg, noSecs )
{
   let match = coordStr.match( noSecs ? "'?([+-]?)([0-9]*)[ :]([0-9]*(.[0-9]*)?)'?" :
                                        "'?([+-]?)([0-9]*)[ :]([0-9]*)[ :]([0-9]*(.[0-9]*)?)'?" );
   if ( match == null )
      return null;
   let coord = new DMSangle();
   if ( match.length < (noSecs ? 3 : 4) )
      throw new Error( "Invalid coordinates" );
   coord.deg = parseInt( match[2], 10 );
   if ( coord.deg < mindeg || coord.deg > maxdeg )
      throw new Error( "Invalid coordinates" );
   coord.min = parseInt( match[3], 10 );
   if ( coord.min < 0 || coord.min >= 60 )
      throw new Error( "Invalid coordinates (minutes)" );
   if ( noSecs )
      coord.sec = 0;
   else
   {
      coord.sec = parseFloat( match[4] );
      if ( coord.sec < 0 || coord.sec >= 60 )
         throw new Error( "Invalid coordinates (seconds)" );
   }
   coord.sign = (match[1] == '-') ? -1 : 1;
   return coord;
};

DMSangle.FromAngle = function( angle )
{
   let coord = new DMSangle();
   if ( angle < 0 )
   {
      coord.sign = -1;
      angle = -angle;
   }
   coord.deg = Math.trunc( angle );
   coord.min = Math.trunc( (angle - coord.deg)*60 );
   coord.sec = (angle - coord.deg - coord.min/60)*3600;

   if ( coord.sec > 59.999 )
   {
      coord.sec = 0;
      coord.min++;
      if ( coord.min == 60 )
      {
         coord.min = 0;
         coord.deg++;
      }
   }

   return coord;
};

// ----------------------------------------------------------------------------

Point.prototype.PrintAsRaDec = function()
{
   console.writeln( "RA: ", DMSangle.FromAngle( this.x/15 ).ToString(),
                    "  Dec: ", DMSangle.FromAngle( this.y ).ToString() );
};

Point.prototype.Print = function()
{
   console.writeln( format( "%f %f", this.x, this.y ) );
};

// ----------------------------------------------------------------------------

Matrix.prototype.Apply = function( p )
{
   let matrixP = new Matrix( [p.x, p.y, 1], 3, 1 );
   let p1 = this.mul( matrixP );
   return new Point( p1.at( 0, 0 ), p1.at( 1, 0 ) );
};

Matrix.prototype.ApplyToPoints = function( points )
{
   let result = [];
   for ( let i = 0; i < points.length; ++i )
      result.push( this.Apply( points[i] ) );
   return result;
};

Matrix.prototype.Print = function()
{
   for ( let y = 0; y < this.rows; ++y )
   {
      console.write( "   " );
      for ( let x = 0; x < this.cols; ++x )
         //console.write( format( "%+20.12f", this.at( y, x ) ) );
         console.write( format( "%+20g", this.at( y, x ) ) );
      console.writeln( "" );
   }
};

Matrix.prototype.toString = function()
{
   let str = "[";
   for ( let row = 0; row < this.rows; ++row )
   {
      let rowStr = "[";
      for ( let col = 0; col < this.columns; ++col )
      {
         if ( col > 0 )
            rowStr += ";";
         rowStr += this.at( row, col ).toString();
      }
      str += rowStr + "]";
   }
   return str + "]";
};

// ----------------------------------------------------------------------------

function ReferNPolyn( polDegree )
{
   this.__base__ = Matrix;
   this.__base__( 2, ((polDegree + 1)*(polDegree + 2))/2 );
   this.polDegree = polDegree;
};

ReferNPolyn.prototype = new Matrix;

ReferNPolyn.prototype.Apply = function( p )
{
   let coef = this.GetPointCoef( p );
   let x = 0, y = 0;
   for ( let i = 0; i < coef.length; ++i )
   {
      x += coef[i]*this.at( 0, i );
      y += coef[i]*this.at( 1, i );
   }
   return new Point( x, y );
};

ReferNPolyn.prototype.ApplyToPoints = function( points )
{
   let result = [];
   for ( let i = 0; i < points.length; ++i )
      result.push( this.Apply( points[i] ) );
   return result;
};

ReferNPolyn.prototype.GetPointCoef = function( p )
{
   let values = Array( this.GetNumCoef() );
   let idx = 0;
   for ( let o = 0; o <= this.polDegree; ++o )
   {
      let x = 1;
      for ( let i = 0; i <= o; ++i )
      {
         values[idx+o-i] = x;
         x *= p.x;
      }
      let y = 1;
      for ( let i = 0; i <= o; ++i )
      {
         values[idx+i] *= y;
         y *= p.y;
      }
      idx += o+1;
   }
   return values;
};

ReferNPolyn.prototype.GetNumCoef = function( degree )
{
   if ( degree == null )
      return ((this.polDegree + 1)*(this.polDegree + 2))/2;
   return ((degree + 1)*(degree + 2))/2;
};

ReferNPolyn.prototype.ToLinearMatrix = function()
{
   let m = new Matrix( 3, 3 );
   m.at( 0, 0, this.at( 0, 1 ) ); m.at( 0, 1, this.at( 0, 2 ) ); m.at( 0, 2, this.at( 0, 0 ) );
   m.at( 1, 0, this.at( 1, 1 ) ); m.at( 1, 1, this.at( 1, 2 ) ); m.at( 1, 2, this.at( 1, 0 ) );
   m.at( 2, 0, 0 );               m.at( 2, 1, 0);                m.at( 2, 2, 1 );
   return m;
};

ReferNPolyn.prototype.FromLinearMatrix = function( m )
{
   let ref = new ReferNPolyn( 1 );
   ref.at( 0, 0, m.at( 0, 2 ) ); ref.at( 0, 1, m.at( 0, 0 ) ); ref.at( 0, 2, m.at( 0, 1 ) );
   ref.at( 1, 0, m.at( 1, 2 ) ); ref.at( 1, 1, m.at( 1, 0 ) ); ref.at( 1, 2, m.at( 1, 1 ) );
   return ref;
};

// ----------------------------------------------------------------------------

function ReferSpline( p1, p2, weights, order, smoothing, simplify, rejectFraction, incremental )
{
   this.order = (order === undefined || order === null) ? 2 : order;
   this.smoothing = (smoothing === undefined || smoothing === null) ? 0.01 : smoothing;
   this.simplify = (simplify === undefined || simplify === null) ? true : simplify;
   this.tolerance = 0.05;
   this.rejectFraction = (rejectFraction === undefined || rejectFraction === null) ? 0.10 : rejectFraction;
   this.incremental = (incremental === undefined || incremental === null) ? true : incremental;
   this.truncated = false;
   if ( p1 && p2 )
      this.InitFromControlPoints( p1, p2, weights );
}

ReferSpline.prototype.InitFromControlPoints = function( p1, p2, weights )
{
   let P1 = [], P2 = [];
   let xmin = Number.MAX_VALUE, xmax = -Number.MAX_VALUE;
   let ymin = Number.MAX_VALUE, ymax = -Number.MAX_VALUE;
   let zxmin = Number.MAX_VALUE, zxmax = -Number.MAX_VALUE;
   let zymin = Number.MAX_VALUE, zymax = -Number.MAX_VALUE;
   for ( let i = 0; i < p1.length; ++i )
      if ( p1[i] && p2[i] )
      {
         P1.push( p1[i] );
         P2.push( p2[i] );

         if ( p1[i].x < xmin )
            xmin = p1[i].x;
         if ( p1[i].x > xmax )
            xmax = p1[i].x;

         if ( p1[i].y < ymin )
            ymin = p1[i].y;
         if ( p1[i].y > ymax )
            ymax = p1[i].y;

         if ( p2[i].x < zxmin )
            zxmin = p2[i].x;
         if ( p2[i].x > zxmax )
            zxmax = p2[i].x;

         if ( p2[i].y < zymin )
            zymin = p2[i].y;
         if ( p2[i].y > zymax )
            zymax = p2[i].y;
      }

   let dx = xmax - xmin;
   let dy = ymax - ymin;
   let dzx = zxmax - zxmin;
   let dzy = zymax - zymin;
   let dxy = Math.sqrt( dx*dx + dy*dy );
   let dz = Math.sqrt( dzx*dzx + dzy*dzy );
   let res = dz/dxy; // deg/px
   let gToI = zxmin >= 0 && zxmax > 0 && zymin >= 0 && zymax > 0;

   this.spline = new PointSurfaceSpline;

   this.spline.maxSplinePoints = WCS_MAX_SPLINE_POINTS;
   this.spline.simplifiersEnabled = this.simplify;
   this.spline.simplifierRejectFraction = this.rejectFraction;

   if ( this.incremental )
   {
      this.spline.incrementalFunctionEnabled = true;
      this.spline.linearFunction = Math.homography( P1, P2 );
   }

   this.spline.initialize( P1, P2,
                           gToI ? this.smoothing : this.smoothing*res,
                           null/*weights*/,
                           this.order,
                           (this.order == 2) ? RBFType_ThinPlateSpline : RBFType_VariableOrder );

   this.truncated = this.spline.truncatedX || this.spline.truncatedY;
   this.simpleX = this.spline.pointsX;
   this.simpleY = this.spline.pointsY;
};

ReferSpline.prototype.Apply = function( p )
{
   return this.spline.evaluate( p );
};

ReferSpline.prototype.ApplyToPoints = function( points )
{
   return this.spline.evaluate( points );
};

// ----------------------------------------------------------------------------

function MultipleLinearRegression( polDegree, coords1, coords2 )
{
   if ( coords1.length != coords2.length )
      throw "Input arrays of different size in Multiple Linear Regression";
   let numSamples =0;
   for ( let i = 0; i < coords1.length; ++i )
      if ( coords1[i] && coords2[i] )
         numSamples++;
   //console.writeln("Samples: ", numSamples);
   if ( numSamples < 4 )
      throw "There are too few valid samples";
   // Uses independent multiple linear regression for x and y
   // The model is: Y = X * B + err
   // The regresand Y contains the x (or y) of the predicted coordinates coords2
   // The regresors X contains the vectors (x,y,1) with the source coordinates coords1
   // The parameter vector B contains the factors of the expression xc = xi*B0 + yi*B1 + B2
   let ref_1_2 = new ReferNPolyn( polDegree );
   let numCoefs = ref_1_2.GetNumCoef();
   let Y1 = new Matrix( numSamples, 1 );
   let Y2 = new Matrix( numSamples, 1 );
   let X = new Matrix( numSamples, numCoefs );
   let row = 0;
   for ( let i = 0; i < coords1.length; ++i )
      if ( coords1[i] && coords2[i] )
      {
         //console.writeln(coords1[i]," ",coords2[i]);
         Y1.at( row, 0, coords2[i].x );
         Y2.at( row, 0, coords2[i].y );

         let Xval = ref_1_2.GetPointCoef( coords1[i] );
         for ( let c = 0; c < numCoefs; ++c )
            X.at( row, c, Xval[c] );
         row++;
      }

   // Solve the two multiple regressions
   let XT = X.transpose();
   let XT_X_inv_XT = (XT.mul( X )).inverse().mul( XT );
   let B1 = XT_X_inv_XT.mul( Y1 );
   let B2 = XT_X_inv_XT.mul( Y2 );

   // Create the correction matrix that transform from coords1 to coords2
   //console.writeln( "B1:" ); B1.Print();
   //console.writeln( "B2:" ); B2.Print();
   for ( let i = 0; i < numCoefs; ++i )
   {
      ref_1_2.at( 0, i, B1.at( i, 0 ) );
      ref_1_2.at( 1, i, B2.at( i, 0 ) );
   }
   //console.writeln( "Correction matrix:" );
   //ref_1_2.Print();

   // Calculate R2 and RMS
/*   let SSR = 0;
   for ( let i = 0; i < coords1.length; ++i )
   {
      if ( coords1[i] && coords2[i] )
      {
         let c2 = ref_1_2.Apply( coords1[i] );
         let errX = c2.x-coords2[i].x;
         let errY = c2.y-coords2[i].y;
         //console.writeln( format( "%f;%f;%f;%f", coords1[i].x, coords1[i].y, errX, errY ) );
         SSR += errX*errX + errY*errY;
      }
   }
   let RMSerr = Math.sqrt( SSR/numSamples );*/

   //return { ref_1_2: ref_1_2, rms: RMSerr };
   return ref_1_2;
}

// ----------------------------------------------------------------------------

function MultipleLinearRegressionHelmert( coords1, coords2, ref1, ref2 )
{
   if ( coords1.length != coords2.length )
      throw "Input arrays of different size in Multiple Linear Regression";
   let numSamples = 0;
   for ( let i = 0; i < coords1.length; ++i )
      if ( coords1[i] && coords2[i] )
         numSamples++;
   //console.writeln( "Samples: ", numSamples );
   if ( numSamples < 4 )
      throw "There are too few valid samples";

   // Detect mirror case
   let refMirror = MultipleLinearRegression( 1, coords1, coords2 ).ToLinearMatrix();
   let mirrorFactor = (refMirror.at( 0, 1 ) * refMirror.at( 1, 0 ) > 0) ? 1 : -1;

   // Uses independent multiple linear regression for x and y
   // The model is: Y = X * B + err
   // The regresand Y contains the x (or y) of the predicted coordinates coords2
   // The regresors X contains the vectors (x,y,1) with the source coordinates coords1
   // The parameter vector B contains the factors of the expression xc = xi*B0 + yi*B1 + B2
   let Y = new Matrix( numSamples*2, 1 );
   let X = new Matrix( numSamples*2, 2 );
   let row = 0;
   for ( let i = 0; i < coords1.length; ++i )
      if ( coords1[i] && coords2[i] )
      {
         //console.writeln( coords1[i], " ", coords2[i] );
         Y.at( row*2,     0, coords2[i].x - ref2.x );
         Y.at( row*2 + 1, 0, coords2[i].y - ref2.y );

         X.at( row*2,     0,  coords1[i].x - ref1.x );
         X.at( row*2,     1,  coords1[i].y - ref1.y );
         X.at( row*2 + 1, 1,  mirrorFactor*(coords1[i].x - ref1.x) );
         X.at( row*2 + 1, 0, -mirrorFactor*(coords1[i].y - ref1.y) );

         ++row;
      }

   // Solve the two multiple regressions
   let XT = X.transpose();
   let XT_X_inv_XT = (XT.mul( X )).inverse().mul( XT );
   let B = XT_X_inv_XT.mul( Y );

   // Create the correction matrix that transform from coords1 to coords2
   let m = new Matrix( 3, 3 );
   m.at( 0, 0, B.at( 0, 0 ) );              m.at( 0, 1, B.at( 1, 0 ) );               m.at( 0, 2, 0 );
   m.at( 1, 0, mirrorFactor*B.at( 1, 0 ) ); m.at( 1, 1, -mirrorFactor*B.at( 0, 0 ) ); m.at( 1, 2, 0 );
   m.at( 2, 0, 0 );                         m.at( 2, 1, 0 );                          m.at( 2, 2, 1 );
   //console.writeln( "m" ); m.Print();

   let t1 = new Matrix( 1, 0, -ref1.x,
                        0, 1, -ref1.y,
                        0, 0, 1 );
   let t2 = new Matrix( 1, 0, ref2.x,
                        0, 1, ref2.y,
                        0, 0, 1 );
   let ref_1_2 = t2.mul( m.mul( t1 ) );
   //console.writeln( "ref_1_2" ); ref_1_2.Print();
   //console.writeln( "refMirror" ); refMirror.Print();
   return ref_1_2;
}

// ----------------------------------------------------------------------------

function ApplySTF( view, stf )
{
   let HT = new HistogramTransformation;
   if ( view.image.isColor )
   {
      let stfActive = false;
      for ( let i = 0; i < 3 && !stfActive; ++i )
         stfActive |= stf[i][1] != 0 || stf[i][0] != 0.5 || stf[i][2] != 1;
      if ( !stfActive )
         return;
      HT.H = [ [ stf[0][1], stf[0][0], stf[0][2], 0, 1 ],
               [ stf[1][1], stf[1][0], stf[1][2], 0, 1 ],
               [ stf[2][1], stf[2][0], stf[2][2], 0, 1 ],
               [ 0,         0.5,       1,         0, 1 ],
               [ 0,         0.5,       1,         0, 1 ] ];
   }
   else
   {
      if ( stf[0][1] == 0 && stf[0][0] == 0.5 && stf[0][2] == 1 )
         return;
      HT.H = [ [ 0,         0.5,       1,         0, 1 ],
               [ 0,         0.5,       1,         0, 1 ],
               [ 0,         0.5,       1,         0, 1 ],
               [ stf[0][1], stf[0][0], stf[0][2], 0, 1 ],
               [ 0,         0.5,       1,         0, 1 ] ];
   }

   console.writeln( format( "<b>Applying STF to '%ls'</b>:\x1b[38;2;100;100;100m", view.id ) );
   HT.executeOn( view, false/*swapFile*/ );
   console.write( "\x1b[0m" );
}
