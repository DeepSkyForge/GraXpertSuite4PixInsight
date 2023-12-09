/*
 * Astronomical Catalogs
 *
 * This file is part of ImageSolver and AnnotateImage scripts
 *
 * Copyright (C) 2012-2023, Andres del Pozo
 * Contributions (C) 2019-2023, Juan Conejero (PTeam)
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice,
 *    this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */

#include <pjsr/APASSFlag.jsh>
#include <pjsr/GaiaFlag.jsh>
#include <pjsr/ReadTextOptions.jsh>

#define NULLMAG 1000

function CatalogRegister()
{
   this.catalogs = [];

   this.Register = function( catalog, id )
   {
      this.catalogs.push( { id:          id ? id : catalog.id,
                            name:        catalog.name,
                            constructor: catalog.GetConstructor() } );
   };

   this.FindById = function( catalogId )
   {
      if ( !catalogId )
         return null;
      for ( let i = 0; i < this.catalogs.length; ++i )
         if ( this.catalogs[i].id == catalogId )
            return this.catalogs[i];
      return null;
   };

   this.FindByName = function( catalogName )
   {
      if ( !catalogName )
         return null;
      catalogName = catalogName.trim();
      for ( let i = 0; i < this.catalogs.length; ++i )
         if ( this.catalogs[i].name == catalogName )
            return this.catalogs[i];
      return null;
   };

   this.GetCatalog = function( idx )
   {
      if ( typeof( idx ) == "string" )
      {
         let cat = this.FindById( idx );
         if ( cat === null )
            cat = this.FindByName( idx );
         if ( cat === null )
            return null;
         return eval( cat.constructor );
      }
      else
         return eval( this.catalogs[idx].constructor );
   };
}

var __catalogRegister__ = new CatalogRegister();

// ******************************************************************
// CatalogRecord: Stores the information of a record of a catalog
// ******************************************************************

function CatalogRecord( posRD, diameter, name, magnitude, axisRatio, posAngle )
{
   // Position, where posRD.x=RA(deg) and posRD.y=Dec(deg)
   this.posRD = posRD;

   // Diameter in degrees >= 0
   this.diameter = (diameter !== undefined) ? diameter : 0;

   // Object's name or empty string
   this.name = (name !== undefined) ? name : '';

   // Magnitude or undefined
   if ( magnitude !== undefined )
      this.magnitude = magnitude;

   if ( axisRatio !== undefined && posAngle !== undefined )
   {
      // Axis ratio: major_axis/minor_axis >= 1
      this.axisRatio = axisRatio;
      // Position angle: position angle of the major axis in degrees with
      // respect to the north pole direction, measured positive eastwards.
      this.posAngle = posAngle;
   }
   else
   {
      this.axisRatio = 1;
      this.posAngle = null;
   }
}

// ******************************************************************
// Catalog: Base class of all catalogs
// ******************************************************************

function Catalog( id, name )
{
   this.__base__ = ObjectWithSettings;
   this.__base__( SETTINGS_MODULE, id/*prefix*/, []/*properties*/ );

   this.id = id;
   this.name = name;
   this.objects = null;

   this.GetDefaultLabels = function()
   {
      return [null, null, null, null, this.fields[0], null, null, null];
   };
}

Catalog.prototype = new ObjectWithSettings;

// ******************************************************************
// Base class of catalogs that can filter objects by a range of
// magnitudes for annotation.
// ******************************************************************

function CatalogWithMagnitudeFilters( id, name )
{
   this.__base__ = Catalog;
   this.__base__( id, name );

   this.GetMagnitudeFilterControls = function( parent )
   {
      let magnitude_Label = new Label( parent );
      magnitude_Label.text = "Magnitude filter:";
      magnitude_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;
      magnitude_Label.minWidth = parent.labelWidth1;

      let filter_Combo = null;
      if ( this.filters.length > 1 )
      {
         filter_Combo = new ComboBox( parent );
         filter_Combo.editEnabled = false;
         filter_Combo.toolTip = "<p>The filter used in magnitude tests.</p>";
         filter_Combo.onItemSelected = function()
         {
            this.dialog.activeFrame.object.catalog.magnitudeFilter = filter_Combo.itemText( filter_Combo.currentItem );
            this.dialog.activeFrame.object.catalog.bounds = null;
         };
         for ( let f = 0; f < this.filters.length; ++f )
         {
            filter_Combo.addItem( this.filters[f] );
            if ( this.filters[f] == this.magnitudeFilter )
               filter_Combo.currentItem = filter_Combo.numberOfItems-1;
         }
      }

      let magnitudeMin_Edit = new Edit( parent );
      magnitudeMin_Edit.setFixedWidth( parent.editWidth );
      if ( this.magMin != NULLMAG )
         magnitudeMin_Edit.text = format( "%g", this.magMin );
      magnitudeMin_Edit.toolTip = "<p>Draw only objects with magnitudes dimmer than this value.<br/>" +
         "It can be empty to disable minimum magnitude filtering.</p>";
      magnitudeMin_Edit.onTextUpdated = function( value )
      {
         if ( value != null && value.trim().length > 0 )
            this.dialog.activeFrame.object.catalog.magMin = parseFloat( value );
         else
            this.dialog.activeFrame.object.catalog.magMin = NULLMAG;
         this.dialog.activeFrame.object.catalog.bounds = null;
      };

      let magnitudeMax_Edit = new Edit( parent );
      magnitudeMax_Edit.setFixedWidth( parent.editWidth );
      if ( this.magMax != NULLMAG )
         magnitudeMax_Edit.text = format( "%g", this.magMax );
      magnitudeMax_Edit.toolTip = "<p>Draw only objects with magnitudes brighter than this value.<br/>" +
         "It can be empty to disable maximum magnitude filtering.</p>";
      magnitudeMax_Edit.onTextUpdated = function( value )
      {
         if ( value != null && value.trim().length > 0 )
            this.dialog.activeFrame.object.catalog.magMax = parseFloat( value );
         else
            this.dialog.activeFrame.object.catalog.magMax = NULLMAG;
         this.dialog.activeFrame.object.catalog.bounds = null;
      };

      let magnitudeSeparator_Label = new Label( parent );
      magnitudeSeparator_Label.text = " - ";

      let magnitudeSizer = new HorizontalSizer;
      magnitudeSizer.scaledSpacing = 4;
      magnitudeSizer.add( magnitude_Label );
      if ( filter_Combo )
         magnitudeSizer.add( filter_Combo );
      magnitudeSizer.add( magnitudeMin_Edit );
      magnitudeSizer.add( magnitudeSeparator_Label );
      magnitudeSizer.add( magnitudeMax_Edit );
      magnitudeSizer.addStretch();
      magnitudeSizer.setAlignment( magnitudeSeparator_Label, Align_Center );

      return [ magnitudeSizer ];
   };
}

// ******************************************************************
// NullCatalog
// ******************************************************************

function NullCatalog()
{
   this.__base__ = Catalog;
   this.__base__( "null", "null" );

   this.GetConstructor = function()
   {
      return "new NullCatalog()";
   };
};

NullCatalog.prototype = new Catalog;

// ******************************************************************
// Auxiliary function for calculation of astrometric, proper and
// apparent places in spherical equatorial coordinates.
//
// P  Reference to a Position object.
//
// B  Reference to a body for position calculation. Can be an
//    EphemerisHandle object (for solar system bodies) or a
//    StarPosition object (for catalog stars).
// ******************************************************************

function astrometricPlace( P, B )
{
   return P.astrometric( B ).toSpherical2Pi();
}

function properPlace( P, B )
{
   return P.proper( B ).toSpherical2Pi();
}

function apparentPlace( P, B )
{
   return P.apparent( B ).toSpherical2Pi();
}

function placeFunctionForReferenceSystem( referenceSystem )
{
   switch ( referenceSystem )
   {
   default: // ?!
   case "ICRS": return astrometricPlace;
   case "GCRS": return properPlace;
   case "GAPPT": return apparentPlace;
   }
}

// ******************************************************************
// VisiblePlanets: Geometric (ICRS) positions of the main planets.
// ******************************************************************

function VisiblePlanets()
{
   this.description = "Visible planets (ICRS/J2000.0 coordinates)";
   this.fields = [ "Name", "Coordinates", "Magnitude" ];

   this.__base__ = Catalog;
   this.__base__( "Planets", "Planets" );

   this.Validate = function()
   {
      return true;
   };

   this.Load = function( metadata )
   {
      this.objects = [];
      if ( metadata.observationTime )
      {
         let planets = ["Me", "Ve", "Ma", "Ju", "Sa", "Ur", "Ne", "Pl"];
         let objectNames = [];
         let E = EphemerisFile.fundamentalEphemerides;
         let P = new Position( metadata.observationTime, "UTC" );
         if ( metadata.topocentric && metadata.obsLongitude != null && metadata.obsLatitude != null )
            P.observer = new ObserverPosition( metadata.obsLongitude, metadata.obsLatitude,
                                               (metadata.obsHeight != null) ? metadata.obsHeight : 0 );
         let F = placeFunctionForReferenceSystem( metadata.referenceSystem );
         for ( let i = 0; i < planets.length; ++i )
         {
            let H = new EphemerisHandle( E, planets[i], "SSB" );
            let q = F( P, H );
            let posRD = new Point( Math.deg( q[0] ), Math.deg( q[1] ) );
            let posI = metadata.Convert_RD_I( posRD, true/*unscaled*/ );
            if ( posI != null
              && posI.x > 0
              && posI.y > 0
              && posI.x < metadata.width
              && posI.y < metadata.height )
            {
               this.objects.push( new CatalogRecord(
                        posRD, 0/*diameter*/, H.objectName, P.apparentVisualMagnitude( H ) ) );
               objectNames.push( H.objectName );
            }
         }

         if ( objectNames.length > 0 )
            console.writeln( "<end><cbr><b>Visible planets</b>: ", objectNames.join( ", " ) );
      }
   };

   this.GetEditControls = function( parent )
   {
      return [];
   };

   this.GetDefaultLabels = function()
   {
      return [null, null, null, null, "Name", null, null, "Magnitude"];
   };

   this.GetConstructor = function()
   {
      return "new VisiblePlanets()";
   };
}

VisiblePlanets.prototype = new Catalog;

__catalogRegister__.Register( new VisiblePlanets );

// ******************************************************************
// VisibleAsteroids: Geometric (ICRS) positions of core asteroids.
// ******************************************************************

function VisibleAsteroids()
{
   this.description = "DE430/DE440 asteroids (343 objects, ICRS/J2000.0 coordinates)";
   this.fields = [ "Name", "Coordinates", "Magnitude" ];

   this.__base__ = Catalog;
   this.__base__( "Asteroids", "Asteroids" );

   this.Validate = function()
   {
      return true;
   };

   this.Load = function( metadata )
   {
      this.objects = [];
      if ( metadata.observationTime )
      {
         let asteroids = EphemerisFile.asteroidEphemerides.objects;
         let objectNames = [];
         let E = EphemerisFile.asteroidEphemerides;
         let P = new Position( metadata.observationTime, "UTC" );
         if ( metadata.topocentric && metadata.obsLongitude != null && metadata.obsLatitude != null )
            P.observer = new ObserverPosition( metadata.obsLongitude, metadata.obsLatitude,
                                               (metadata.obsHeight != null) ? metadata.obsHeight : 0 );
         let F = placeFunctionForReferenceSystem( metadata.referenceSystem );
         for ( let i = 0; i < asteroids.length; ++i )
         {
            let H = new EphemerisHandle( E, asteroids[i][0], "SSB" );
            let q = F( P, H );
            let posRD = new Point( Math.deg( q[0] ), Math.deg( q[1] ) );
            let posI = metadata.Convert_RD_I( posRD, true/*unscaled*/ );
            if ( posI != null
              && posI.x > 0
              && posI.y > 0
              && posI.x < metadata.width
              && posI.y < metadata.height )
            {
               let objectName = asteroids[i][0] + ' ' + asteroids[i][2]; // e.g. '1 Ceres'
               this.objects.push( new CatalogRecord(
                        posRD, 0/*diameter*/, objectName, P.apparentVisualMagnitude( H ) ) );
               objectNames.push( objectName );
            }
         }

         if ( objectNames.length > 0 )
            console.writeln( "<end><cbr><b>Visible asteroids</b>: ", objectNames.join( ", " ) );
      }
   };

   this.GetEditControls = function( parent )
   {
      return [];
   };

   this.GetDefaultLabels = function()
   {
      return [null, null, null, null, "Name", null, null, "Magnitude"];
   };

   this.GetConstructor = function()
   {
      return "new VisibleAsteroids()";
   };
}

VisibleAsteroids.prototype = new Catalog;

__catalogRegister__.Register( new VisibleAsteroids );

// ******************************************************************
// CustomXEPHFiles: Geometric (ICRS) positions of solar system bodies.
// ******************************************************************

function PathEditControl( parent, catalog, index )
{
   this.__base__ = Control;
   this.__base__( parent );

   this.catalog = catalog;
   this.index = index;
   this.xephFilePathProperty = "xephFilePath" + this.index.toString();

   this.path_Edit = new Edit( parent );
   this.path_Edit.text = this.catalog[this.xephFilePathProperty];
   this.path_Edit.onTextUpdated = ( value ) =>
   {
      this.catalog[this.xephFilePathProperty] = value;
   };

   this.path_Button = new ToolButton( parent );
   this.path_Button.icon = parent.scaledResource( ":/icons/select-file.png" );
   this.path_Button.setScaledFixedSize( 20, 20 );
   this.path_Button.toolTip = "<p>Select the input XEPH file.</p>";
   this.path_Button.onClick = () =>
   {
      let gdd = new OpenFileDialog;
      if ( this.catalog[this.xephFilePathProperty].length > 0 )
         gdd.initialPath = this.catalog[this.xephFilePathProperty];
      gdd.caption = "Select Ephemeris File";
      gdd.filters = [["XEPH Ephemeris Files", "*.xeph"]];
      if ( gdd.execute() )
      {
         this.catalog[this.xephFilePathProperty] = gdd.fileName;
         this.path_Edit.text = gdd.fileName;
      }
   };

   this.sizer = new HorizontalSizer;
   this.sizer.spacing = 4;
   this.sizer.add( this.path_Edit, 100 );
   this.sizer.add( this.path_Button );
}

PathEditControl.prototype = new Control;

function DirEditControl( parent, catalog )
{
   this.__base__ = Control;
   this.__base__( parent );

   this.catalog = catalog;

   this.path_Edit = new Edit( parent );
   this.path_Edit.text = this.catalog.searchDirPath;
   this.path_Edit.onTextUpdated = ( value ) =>
   {
      this.catalog.searchDirPath = value;
   };

   this.path_Button = new ToolButton( parent );
   this.path_Button.icon = parent.scaledResource( ":/icons/select-file.png" );
   this.path_Button.setScaledFixedSize( 20, 20 );
   this.path_Button.toolTip = "<p>Select directory.</p>";
   this.path_Button.onClick = () =>
   {
      let gdd = new GetDirectoryDialog;
      if ( this.catalog.searchDirPath.length > 0 )
         gdd.initialPath = this.catalog.searchDirPath;
      gdd.caption = "Select XEPH Files Directory";
      if ( gdd.execute() )
      {
         this.catalog.searchDirPath = gdd.directory;
         this.path_Edit.text = gdd.directory;
      }
   };

   this.sizer = new HorizontalSizer;
   this.sizer.spacing = 4;
   this.sizer.add( this.path_Edit, 100 );
   this.sizer.add( this.path_Button );
}

DirEditControl.prototype = new Control;

function CustomXEPHFilesControls( parent, catalog )
{
   this.__base__ = Control;
   this.__base__( parent );

   this.catalog = catalog;

   this.individualFilesMode_RadioButton = new RadioButton( this );
   this.individualFilesMode_RadioButton.text = "Individual files";
   this.individualFilesMode_RadioButton.toolTip =
      "<p>Enable this mode to select up to three .xeph files for annotation " +
      "of solar system objects based on positional ephemerides.</p>";
   this.individualFilesMode_RadioButton.onClick = () =>
   {
      this.catalog.searchDirMode = false;
      this.updateControls();
   };

   this.directorySearchMode_RadioButton = new RadioButton( this );
   this.directorySearchMode_RadioButton.text = "Directory search";
   this.directorySearchMode_RadioButton.toolTip =
      "<p>Enable this mode to select a directory where the script will search " +
      "for .xeph files. All existing .xeph files in the specified directory " +
      "will be used to annotate solar system objects based on computed " +
      "positional ephemerides.</p>";
   this.directorySearchMode_RadioButton.onClick = () =>
   {
      this.catalog.searchDirMode = true;
      this.updateControls();
   };

   this.mode_Sizer = new HorizontalSizer;
   this.mode_Sizer.add( this.individualFilesMode_RadioButton );
   this.mode_Sizer.addSpacing( 24 );
   this.mode_Sizer.add( this.directorySearchMode_RadioButton );
   this.mode_Sizer.addStretch();

   this.pathEdit1_Control = new PathEditControl( this, catalog, 1 );
   this.pathEdit2_Control = new PathEditControl( this, catalog, 2 );
   this.pathEdit3_Control = new PathEditControl( this, catalog, 3 );

   this.dirEdit_Control = new DirEditControl( this, catalog );

   this.sizer = new VerticalSizer;
   this.sizer.spacing = 4;
   this.sizer.add( this.mode_Sizer );
   this.sizer.add( this.pathEdit1_Control );
   this.sizer.add( this.pathEdit2_Control );
   this.sizer.add( this.pathEdit3_Control );
   this.sizer.add( this.dirEdit_Control );

   this.updateControls = () =>
   {
      if ( this.catalog.searchDirMode )
      {
         this.individualFilesMode_RadioButton.checked = false;
         this.directorySearchMode_RadioButton.checked = true;
         this.pathEdit1_Control.hide();
         this.pathEdit2_Control.hide();
         this.pathEdit3_Control.hide();
         this.dirEdit_Control.show();
      }
      else
      {
         this.individualFilesMode_RadioButton.checked = true;
         this.directorySearchMode_RadioButton.checked = false;
         this.pathEdit1_Control.show();
         this.pathEdit2_Control.show();
         this.pathEdit3_Control.show();
         this.dirEdit_Control.hide();
      }

      this.dialog.ensureLayoutUpdated();
      this.dialog.adjustToContents();
   };

   this.updateControls();
}

CustomXEPHFilesControls.prototype = new Control;

function CustomXEPHFiles()
{
   this.description = "Custom ephemeris files (XEPH format, ICRS/J2000.0 coordinates)";
   this.fields = [ "Name", "Coordinates", "Magnitude" ];
   this.xephFilePath1 = "";
   this.xephFilePath2 = "";
   this.xephFilePath3 = "";
   this.searchDirPath = "";
   this.searchDirMode = false;
   this.filters = ["V"];
   this.magMin = NULLMAG;
   this.magMax = NULLMAG;

   this.__base__ = CatalogWithMagnitudeFilters;
   this.__base__( "CustomXEPHFiles", "Custom XEPH Files" );

   this.properties.push( ["xephFilePath1", DataType_UCString] );
   this.properties.push( ["xephFilePath2", DataType_UCString] );
   this.properties.push( ["xephFilePath3", DataType_UCString] );
   this.properties.push( ["searchDirPath", DataType_UCString] );
   this.properties.push( ["searchDirMode", DataType_Boolean] );
   this.properties.push( ["magMin", DataType_Double] );
   this.properties.push( ["magMax", DataType_Double] );

   this.Validate = function()
   {
      return true;
   };

   this.Load = function( metadata )
   {
      this.objects = [];
      if ( metadata.observationTime )
      {
         let P = new Position( metadata.observationTime, "UTC" );
         if ( metadata.topocentric && metadata.obsLongitude != null && metadata.obsLatitude != null )
            P.observer = new ObserverPosition( metadata.obsLongitude, metadata.obsLatitude,
                                               (metadata.obsHeight != null) ? metadata.obsHeight : 0 );

         let xephFiles = [];
         if ( this.searchDirMode  )
         {
            if ( this.searchDirPath.length > 0 )
            {
               xephFiles = searchDirectory( this.searchDirPath + "/*.xeph" );
               if ( xephFiles.length == 0 )
                  console.writeln( "<end><cbr><br>* Custom XEPH Files: No ephemeris files were found on directory: <raw>" + this.searchDirPath + "</raw>" );
            }
            else
               console.writeln( "<end><cbr><br>* Custom XEPH Files: No search directory has been specified." );
         }
         else
         {
            if ( this.xephFilePath1.length > 0 )
               xephFiles.push( this.xephFilePath1 );
            if ( this.xephFilePath2.length > 0 )
               xephFiles.push( this.xephFilePath2 );
            if ( this.xephFilePath3.length > 0 )
               xephFiles.push( this.xephFilePath3 );
            if ( xephFiles.length == 0 )
               console.writeln( "<end><cbr><br>* Custom XEPH Files: No ephemeris files have been specified." );
         }

         for ( let j = 0; j < xephFiles.length; ++j )
         {
            let xephFilePath = xephFiles[j];
            console.writeln( "<end><cbr><br>Searching ephemeris file: <raw>" + xephFilePath + "</raw>" );
            processEvents();

            let E = new EphemerisFile( xephFilePath );

            let jd1 = Math.calendarTimeToJD( E.startTime.toISOString() );
            let jd2 = Math.calendarTimeToJD( E.endTime.toISOString() );
            let jd = Math.calendarTimeToJD( P.TDB.toISOString() );

            if ( jd < jd1 || jd > jd2 )
            {
               console.criticalln( "<end><cbr>*** Error: Observation time out of range: <raw>" + xephFilePath + "</raw><br>" +
                                   "Requested time ... " + P.TDB.toISOString() + " TDB<br>" +
                                   "The ephemeris file covers the following time span:<br>" +
                                   "Start time ....... " + E.startTime.toISOString() + " TDB<br>" +
                                   "End time ......... " + E.endTime.toISOString() + " TDB" );
               if ( !Parameters.getBoolean( "non_interactive" ) )
                  (new MessageBox( "<p>Observation time out of range.</p>" +
                                   "<p>Requested time: " + P.TDB.toISOString() + " TDB</p>" +
                                   "<p>The ephemeris file #" + idx.toString() + " covers the following time span:</p>" +
                                   "<p>Start time: " + E.startTime.toISOString() + " TDB<br/>" +
                                   "End time:   " + E.endTime.toISOString() + " TDB</p>",
                                   TITLE, StdIcon_Error, StdButton_Ok )).execute();
               return;
            }

            let objectNames = [];

            if ( metadata.sourceImageWindow )
            {
               let A = E.visibleObjects( metadata.sourceImageWindow, P, this.magMax, this.magMin ); // since core 1.8.8-8
               for ( let i = 0; i < A.length; ++i )
               {
                  let a = A[i];
                  let objectName = a[0];
                  if ( objectName.length > 0 )
                     objectName += ' ' + a[1]; // numbered objects, e.g. '1 Ceres'
                  else
                     objectName = a[1]; // unnumbered asteroids and commets
                  this.objects.push( new CatalogRecord( new Point( a[2], a[3] ), 0/*diameter*/, objectName, a[6]/*visMag*/ ) );
                  objectNames.push( objectName );
               }
            }
            else
            {
               let F = placeFunctionForReferenceSystem( metadata.referenceSystem );
               let bodies = E.objects;
               for ( let i = 0; i < bodies.length; ++i )
               {
                  let H = new EphemerisHandle( E, bodies[i][0], "SSB" );
                  let V = P.apparentVisualMagnitude( H );
                  if ( V == null
                     || (this.magMax == NULLMAG || V <= this.magMax)
                     && (this.magMin == NULLMAG || V >= this.magMin) )
                  {
                     let q = F( P, H );
                     let posRD = new Point( Math.deg( q[0] ), Math.deg( q[1] ) );
                     let posI = metadata.Convert_RD_I( posRD, true/*unscaled*/ );
                     if ( posI != null
                       && posI.x > 0
                       && posI.y > 0
                       && posI.x < metadata.width
                       && posI.y < metadata.height )
                     {
                        let objectName = bodies[i][0];
                        if ( objectName.length > 0 )
                           objectName += ' ' + bodies[i][2]; // numbered objects, e.g. '1 Ceres'
                        else
                           objectName = bodies[i][2]; // unnumbered asteroids and commets
                        this.objects.push( new CatalogRecord( posRD, 0/*diameter*/, objectName, V ) );
                        objectNames.push( objectName );
                     }
                  }
               }
            }

            if ( objectNames.length > 0 )
               console.writeln( "<end><cbr><b>Visible bodies</b>: ", objectNames.join( ", " ) );
            else
               console.writeln( "<end><cbr>No visible bodies." );
         }
      }
   };

   this.GetEditControls = function( parent )
   {
      return [ new CustomXEPHFilesControls( parent, this )
             , this.GetMagnitudeFilterControls( parent )[0] ];
   };

   this.GetDefaultLabels = function()
   {
      return [null, null, null, null, "Name", null, null, "Magnitude"];
   };

   this.GetConstructor = function()
   {
      return "new CustomXEPHFiles()";
   };
}

CustomXEPHFiles.prototype = new Catalog;

__catalogRegister__.Register( new CustomXEPHFiles );

// ******************************************************************
// LocalFileCatalog - catalog data stored as local CSV files.
// ******************************************************************

function LocalFileCatalog( id, name, filename )
{
   this.__base__ = Catalog;
   this.__base__( id, name );

   if ( filename !== undefined )
   {
      if ( filename === null || filename.trim().length == 0 )
         throw new Error( "LocalFileCatalog: Internal error: No catalog filename specified" );
      this.catalogPath = File.extractDrive( #__FILE__ ) + File.extractDirectory( #__FILE__ );
      if ( this.catalogPath[this.catalogPath.length-1] != '/' )
         this.catalogPath += '/';
      this.catalogPath += filename.trim();
   }

   this.Validate = function()
   {
      if ( !File.exists( this.catalogPath ) )
      {
         console.criticalln( "<end><cbr>*** Error: Unable to load local catalog file: <raw>" + this.catalogPath + "</raw>" );
         if ( !Parameters.getBoolean( "non_interactive" ) )
            (new MessageBox( "<p>Unable to load local catalog file:</p>" +
                             "<p>" + this.catalogPath + "</p>", TITLE, StdIcon_Error, StdButton_Ok )).execute();
         return false;
      }
      return true;
   };

   this.Load = function( metadata )
   {
      let bounds = metadata.FindImageBounds();

      if ( !this.catalogPath )
         return false;

      this.catalogLines = File.readLines( this.catalogPath, ReadTextOptions_RemoveEmptyLines | ReadTextOptions_TrimLines );

      this.index = { count: 0, aux: {} };
      {
         let headers = this.catalogLines[0].split( ',' );
         this.index.count = headers.length;
         for ( let i = 0; i < headers.length; ++i )
         {
            let header = headers[i].trim();
            switch ( header )
            {
            case "id":
            case "alpha":
            case "delta":
            case "magnitude":
            case "diameter":
            case "axisRatio":
            case "posAngle":
               this.index[header] = i;
               break;
            default:
               this.index.aux[header] = i;
               break;
            }
         }
      }
      if ( this.index.id === undefined ||
           this.index.alpha === undefined ||
           this.index.delta === undefined )
         throw new Error( "Loading local catalog: missing required header fields: " + this.catalogPath );

      let P = new Position( metadata.observationTime, "UTC" );
      if ( metadata.topocentric && metadata.obsLongitude != null && metadata.obsLatitude != null )
         P.observer = new ObserverPosition( metadata.obsLongitude, metadata.obsLatitude,
                                            (metadata.obsHeight != null) ? metadata.obsHeight : 0 );
      let F = placeFunctionForReferenceSystem( metadata.referenceSystem );
      this.objects = [];
      for ( let i = 1; i < this.catalogLines.length; ++i )
      {
         let fields = this.catalogLines[i].split( ',' );
         if ( fields.length < this.index.count )
            continue;
         if ( fields[this.index.alpha].trim().length == 0 || fields[this.index.delta].trim().length == 0 ) // ?!
            continue;

         let q = F( P, new StarPosition( parseFloat( fields[this.index.alpha] ), parseFloat( fields[this.index.delta] ) ) );
         let posRD = new Point( Math.deg( q[0] ), Math.deg( q[1] ) );
         let posI = metadata.Convert_RD_I( posRD, true/*unscaled*/ );
         if ( posI != null
           && posI.x > 0
           && posI.y > 0
           && posI.x < metadata.width
           && posI.y < metadata.height )
         {
            let magnitude = (this.index.magnitude !== undefined && fields[this.index.magnitude].trim().length > 0) ?
                                 parseFloat( fields[this.index.magnitude] ) : undefined;
            if ( this.magMax === undefined || magnitude === undefined
              || this.magMax == NULLMAG    || magnitude <= this.magMax )
            {
               let diameter = (this.index.diameter !== undefined && fields[this.index.diameter].trim().length > 0) ?
                                 parseFloat( fields[this.index.diameter] )/60 : undefined;
               let axisRatio = (this.index.axisRatio !== undefined && fields[this.index.axisRatio].trim().length > 0) ?
                                 parseFloat( fields[this.index.axisRatio] ) : undefined;
               let posAngle = (this.index.posAngle !== undefined && fields[this.index.posAngle].trim().length > 0) ?
                                 parseFloat( fields[this.index.posAngle] ) : undefined;

               let record = new CatalogRecord( posRD, diameter, fields[this.index.id].trim(), magnitude, axisRatio, posAngle );

               // Optional standardized fields
               if ( magnitude !== undefined )
                  record["Magnitude"] = format( "%.2f", magnitude );
               if ( diameter !== undefined )
                  record["Diameter"] = format( "%.2f", diameter );

               // Additional fields
               for ( let j in this.index.aux )
               {
                  let value = fields[this.index.aux[j]].trim();
                  if ( value.length > 0 )
                     record[j] = value;
               }

               this.objects.push( record );
            }
         }
      }

      console.writeln( "\n<b>Catalog ", this.name, "</b>: ", this.objects.length, " of ", this.catalogLines.length-1, " objects" );
      return true;
   };

   this.GetEditControls = function( parent )
   {
      return [];
   };

   this.GetDefaultLabels = function()
   {
      return [null, null, null, null, "Name", null, null, "Common name"];
   };
}

LocalFileCatalog.prototype = new Catalog;

// ******************************************************************
// Messier Catalog (local CSV file)
// ******************************************************************

function MessierCatalog()
{
   this.description = "Messier catalog (110 objects)";
   this.fields = [ "Name", "Coordinates", "Magnitude", "Diameter", "Common name", "NGC/IC" ];

   this.__base__ = LocalFileCatalog;
   this.__base__( "Messier", "Messier", "Messier.csv" );

   this.GetConstructor = function()
   {
      return "new MessierCatalog()";
   };
}

MessierCatalog.prototype = new LocalFileCatalog;

__catalogRegister__.Register( new MessierCatalog );

// ******************************************************************
// NGC-IC Catalog (local CSV file)
// ******************************************************************

function NGCICCatalog()
{
   this.description = "NGC and IC catalogs (9933 objects)";
   this.fields = [ "Name", "Coordinates", "Magnitude", "Diameter", "Common name", "PGC" ];

   this.__base__ = LocalFileCatalog;
   this.__base__( "NGC-IC", "NGC-IC", "NGC-IC.csv" );

   this.GetConstructor = function()
   {
      return "new NGCICCatalog()";
   };
}

NGCICCatalog.prototype = new LocalFileCatalog;

__catalogRegister__.Register( new NGCICCatalog );

// ******************************************************************
// Named Stars Catalog (local CSV file)
// ******************************************************************

function NamedStarsCatalog()
{
   this.description = "Named stars catalog (3671 objects)";
   this.fields = [ "Name", "Coordinates", "Magnitude", "Common name", "HD", "HIP" ];
   this.filters = [ "V" ];
   this.magMin = NULLMAG;
   this.magMax = NULLMAG;

   this.__base__ = LocalFileCatalog;
   this.__base__( "NamedStars", "NamedStars", "NamedStars.csv" );

   this.properties.push( ["magMax", DataType_Double] );

   this.GetConstructor = function()
   {
      return "new NamedStarsCatalog()";
   };

   this.GetEditControls = function( parent )
   {
      let magnitudeMax_Label = new Label( parent );
      magnitudeMax_Label.text = "Maximum magnitude:";
      magnitudeMax_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;
      magnitudeMax_Label.minWidth = parent.labelWidth1;

      let magnitudeMax_Edit = new Edit( parent );
      magnitudeMax_Edit.setFixedWidth( parent.editWidth );
      if ( this.magMax != NULLMAG )
         magnitudeMax_Edit.text = format( "%.2f", this.magMax );
      magnitudeMax_Edit.toolTip = "<p>Draw only objects with magnitudes brighter than this value.<br/>" +
         "It can be empty to disable magnitude filtering.</p>";
      magnitudeMax_Edit.onTextUpdated = function( value )
      {
         if ( value != null && value.trim().length > 0 )
            this.dialog.activeFrame.object.catalog.magMax = parseFloat( value );
         else
            this.dialog.activeFrame.object.catalog.magMax = NULLMAG;
         this.dialog.activeFrame.object.catalog.bounds = null;
      };

      let magnitudeSizer = new HorizontalSizer;
      magnitudeSizer.scaledSpacing = 4;
      magnitudeSizer.add( magnitudeMax_Label );
      magnitudeSizer.add( magnitudeMax_Edit );
      magnitudeSizer.addStretch();

      return [ magnitudeSizer ];
   };

   this.translateGreekLetters = function( name )
   {
      let result = name;
      for ( let i = 1; i <= 9; ++i )
      {
         let superindex = String.fromCharCode(
            [0x00B9, 0x00B2, 0x00B3, 0x2074, 0x2075, 0x2076, 0x2077, 0x2078, 0x2079][i-1] );
         let suffix = format( "%02d", i );
         result =                          result.replace(
            "alf" + suffix, '\u03b1' + superindex ).replace(
            "bet" + suffix, '\u03b2' + superindex ).replace(
            "gam" + suffix, '\u03b3' + superindex ).replace(
            "del" + suffix, '\u03b4' + superindex ).replace(
            "eps" + suffix, '\u03b5' + superindex ).replace(
            "zet" + suffix, '\u03b6' + superindex ).replace(
            "eta" + suffix, '\u03b7' + superindex ).replace(
            "tet" + suffix, '\u03b8' + superindex ).replace(
            "iot" + suffix, '\u03b9' + superindex ).replace(
            "kap" + suffix, '\u03ba' + superindex ).replace(
            "lam" + suffix, '\u03bb' + superindex ).replace(
            "mu." + suffix, '\u03bc' + superindex ).replace(
            "nu." + suffix, '\u03bd' + superindex ).replace(
            "ksi" + suffix, '\u03be' + superindex ).replace(
            "omi" + suffix, '\u03bf' + superindex ).replace(
            "pi." + suffix, '\u03c0' + superindex ).replace(
            "rho" + suffix, '\u03c1' + superindex ).replace(
            "sig" + suffix, '\u03c3' + superindex ).replace(
            "tau" + suffix, '\u03c4' + superindex ).replace(
            "ups" + suffix, '\u03c5' + superindex ).replace(
            "phi" + suffix, '\u03c6' + superindex ).replace(
            "chi" + suffix, '\u03c7' + superindex ).replace(
            "psi" + suffix, '\u03c8' + superindex ).replace(
            "ome" + suffix, '\u03c9' + superindex );
      }
      return            result.replace(
         /\balf\b/, '\u03b1' ).replace(
         /\bbet\b/, '\u03b2' ).replace(
         /\bgam\b/, '\u03b3' ).replace(
         /\bdel\b/, '\u03b4' ).replace(
         /\beps\b/, '\u03b5' ).replace(
         /\bzet\b/, '\u03b6' ).replace(
         /\beta\b/, '\u03b7' ).replace(
         /\btet\b/, '\u03b8' ).replace(
         /\bthe\b/, '\u03b8' ).replace(
         /\biot\b/, '\u03b9' ).replace(
         /\bkap\b/, '\u03ba' ).replace(
         /\blam\b/, '\u03bb' ).replace(
         /\bmu\./,  '\u03bc' ).replace(
         /\bnu\./,  '\u03bd' ).replace(
         /\bksi\b/, '\u03be' ).replace(
         /\bomi\b/, '\u03bf' ).replace(
         /\bpi\./,  '\u03c0' ).replace(
         /\brho\b/, '\u03c1' ).replace(
         /\bsig\b/, '\u03c3' ).replace(
         /\btau\b/, '\u03c4' ).replace(
         /\bups\b/, '\u03c5' ).replace(
         /\bphi\b/, '\u03c6' ).replace(
         /\bchi\b/, '\u03c7' ).replace(
         /\bkhi\b/, '\u03c7' ).replace(
         /\bpsi\b/, '\u03c8' ).replace(
         /\bome\b/, '\u03c9' );
   };
}

NamedStarsCatalog.prototype = new LocalFileCatalog;

__catalogRegister__.Register( new NamedStarsCatalog );

// ----------------------------------------------------------------------------

// ******************************************************************
// VizierCache: Cache of Vizier queries
// ******************************************************************

function VizierCache()
{
   "use strict";
   this.queries = [];
   this.maxSize = 20;

   this.Add = function( center, fov, id, queryResult )
   {
      this.queries.push( {center: center, fov: fov, id: id, queryResult: queryResult} );
      if ( this.queries.length > this.maxSize )
         this.queries = this.queries.slice( 1 );
   };

   this.Get = function( center, fov, id )
   {
      for ( let i = 0; i < this.queries.length; ++i )
      {
         let q = this.queries[i];
         if ( q.id == id )
         {
            let dist = ImageMetadata.Distance( center, q.center );
            if ( dist + fov < q.fov )
            {
               this.queries.splice( i, 1 );
               this.queries.push( q );
               return q.queryResult;
            }
         }
      }
      return null;
   };

   this.Clear = function()
   {
      this.queries = [];
   };
}

var __vizier_cache__;

// ******************************************************************
// Base class for all catalogs downloaded from online VizieR servers.
// ******************************************************************

function VizierCatalog( id, name )
{
   this.__base__ = CatalogWithMagnitudeFilters;
   this.__base__( id, name );

   this.UrlBuilder = null;
   this.ParseRecord = null;
   this.position = null;
   this.catalogMagnitude = null;
   this.magMin = NULLMAG;
   this.magMax = NULLMAG;
   this.epoch = null;
   this.maxRecords = 200000;
   this.queryMargin = 1.2;
   this.maxFov = null;

   this.Load = function( metadata, mirrorServer )
   {
      this.metadata = metadata;
      let center = new Point( this.metadata.ra, this.metadata.dec );
      let fov = this.metadata.SearchRadius();

      if ( this.metadata.observationTime != null )
      {
         this.position = new Position( this.metadata.observationTime, "UTC" );
         if ( this.metadata.topocentric && this.metadata.obsLongitude != null && this.metadata.obsLatitude != null )
            this.position.observer = new ObserverPosition( this.metadata.obsLongitude, this.metadata.obsLatitude,
                                                           (this.metadata.obsHeight != null) ? this.metadata.obsHeight : 0 );
         this.placeFunction = placeFunctionForReferenceSystem( this.metadata.referenceSystem );
         this.epoch = (this.metadata.observationTime - Math.calendarTimeToJD( 2000, 1, 1 ))/365.25 + 2000;
      }
      else
         this.epoch = null;

      let cacheid = this.GetCacheDescriptor();

      if ( __vizier_cache__ == undefined )
         __vizier_cache__ = new VizierCache();

      this.objects = __vizier_cache__.Get( center, fov, cacheid );
      if ( this.objects != null )
      {
         console.writeln( "<b>Catalog ", this.name, format( "</b>: Data retrieved from cache (%u objects).", this.objects.length ) );
      }
      else
      {
         // Increase the size of the query by a small factor in order to be
         // able to use it for similar images.
         fov = Math.min( 180, fov*this.queryMargin );

         if ( !this.DoLoad( center, fov, mirrorServer ) )
         {
            this.objects = null;
            return;
         }
         let actual_fov = 0;
         for ( let i = 0; i < this.objects.length; ++i )
         {
            let dist = ImageMetadata.Distance( center, this.objects[i].posRD );
            if ( dist > actual_fov )
               actual_fov = dist;
         }

         __vizier_cache__.Add( center, actual_fov, cacheid, this.objects );
      }

      if ( this.metadata.ref_I_G )
      {
         let insideObjects = 0;
         for ( let s = 0; s < this.objects.length; ++s )
            if ( this.objects[s] )
            {
               let posI = this.metadata.Convert_RD_I( this.objects[s].posRD, true/*unscaled*/ );
               if ( posI
                 && posI.x > 0
                 && posI.y > 0
                 && posI.x < this.metadata.width
                 && posI.y < this.metadata.height )
               {
                  ++insideObjects;
               }
            }
         console.writeln( "<b>Catalog ", this.name, "</b>: ", insideObjects, " objects inside the image." );
      }
      else
         console.writeln( "<b>Catalog ", this.name, "</b>: ", this.objects.length, " objects." );
   };

   this.removeDownloadFile = function()
   {
      try
      {
         if ( this.outputFileName )
            if ( File.exists( this.outputFileName ) )
               File.remove( this.outputFileName );
      }
      catch ( x )
      {
      }
      finally
      {
         this.outputFileName = null;
      }
   };

   this.DoLoad = function( center, fov, mirrorServer )
   {
      if ( this.metadata.observationTime != null )
         this.epoch = (this.metadata.observationTime - Math.calendarTimeToJD( 2000, 1, 1 ))/365.25 + 2000;
      else
         this.epoch = null;

      this.objects = [];
      this.bounds = null;

      let url = this.UrlBuilder( center, fov, mirrorServer );

      this.outputFileName = File.uniqueFileName( File.systemTempDirectory, 10, "VizierQueryResult-", ".tsv" );

      console.writeln( "<end>\n<b>Downloading Vizier data</b>:" );
      console.writeln( "<raw>" + url + "</raw>" );
      let consoleAbort = console.abortEnabled
      console.abortEnabled = true;
      console.show();

      // Send request
      let download = new FileDownload( url, this.outputFileName );
      try
      {
         download.perform();
      }
      catch ( e )
      {
         console.criticalln( "<end><cbr>*** Error: " + e.toString() );
         if ( !Parameters.getBoolean( "non_interactive" ) )
            (new MessageBox( e.toString(), TITLE, StdIcon_Error, StdButton_Ok )).execute();
      }

      console.abortEnabled = consoleAbort;
      //console.hide();

      if ( !download.ok )
      {
         this.removeDownloadFile();
         return false;
      }

      let file = File.openFileForReading( this.outputFileName );
      if ( !file.isOpen )
      {
         this.removeDownloadFile();
         return false;
      }
      let s = file.read( DataType_ByteArray, file.size );
      file.close();
      this.removeDownloadFile();

      let catalogLines = s.toString().split( "\n" );

      if ( catalogLines.length < 20 )
      {
         // Vizier always returns at least 20 comment lines
         console.criticalln( "<end><cbr>*** Error: There has been an unknown error in the catalog server: too short response." );
         return false;
      }

      let querySize = 0;
      try
      {
         for ( let i = 0; i < catalogLines.length; ++i )
         {
            let line = catalogLines[i];
            if ( line.length == 0 || line.charAt( 0 ) == "#" ) //comment
               continue;
            let tokens = line.split( "|" );
            let object = this.ParseRecord( tokens );
            if ( object
              && object.posRD.x >= 0
              && object.posRD.x <= 360
              && object.posRD.y >= -90
              && object.posRD.y <= 90 )
            {
               this.objects.push( object );
               if ( this.bounds )
                  this.bounds = this.bounds.union( object.posRD.x, object.posRD.y, object.posRD.x, object.posRD.y );
               else
                  this.bounds = new Rect( object.posRD.x, object.posRD.y, object.posRD.x, object.posRD.y );
            }
            querySize++;
            // processEvents();
            // if ( console.abortRequested )
            //    throw "Process aborted";
         }
      }
      catch ( e )
      {
         console.criticalln( "<end><cbr>*** Error: " + e.toString() );
         if ( !Parameters.getBoolean( "non_interactive" ) )
            new MessageBox( e.toString(), TITLE, StdIcon_Error, StdButton_Ok ).execute();
         return false;
      }
      //if ( this.bounds )
      //   console.writeln( format( "Bounds: %f;%f;%f;%f / %f;%f;%f;%f", this.bounds.x0, this.bounds.x1, this.bounds.y0, this.bounds.y1,
      //      this.bounds.x0 - center.x, this.bounds.x1 - center.x, this.bounds.y0 - center.y, this.bounds.y1 - center.y ) );
      if ( this.PostProcessObjects )
         this.PostProcessObjects( this.objects );

      if ( querySize > this.maxRecords - 100 )
         console.warningln( "<end><cbr>** Warning: The server has returned an incomplete query.\n" +
                                      "** Please reduce the value of the magnitude filter." );

      return true;
   };

   this.GetCacheDescriptor = function()
   {
      let filter = this.magnitudeFilter ? this.CreateMagFilter( this.magnitudeFilter, this.magMin, this.magMax ) : "";
      if ( this.epoch == null )
         return format( "%ls&%ls&R=%ls", this.name, filter, this.metadata.referenceSystem );
      return format( "%ls&e=%.2f%ls&R=%ls", this.name, this.epoch, filter, this.metadata.referenceSystem );
   };

   this.CreateMagFilter = function( field, min, max )
   {
      if ( min != NULLMAG && max != NULLMAG )
         return "&" + field + format( "=%g..%g", min, max );
      if ( max != NULLMAG )
         return "&" + field + format( "=<%g", max );
      if ( min != NULLMAG )
         return "&" + field + format( "=>%g", min );
      return "";
   };

   this.Validate = function()
   {
      if ( this.catalogMagnitude != null && this.magMin != NULLMAG && this.magMax != NULLMAG )
         if ( this.magMin > this.magMax )
         {
            console.criticalln( "<end><cbr>*** Error: Invalid magnitude filter: The minimum cannot be greater than the maximum." );
            if ( !Parameters.getBoolean( "non_interactive" ) )
               (new MessageBox( "Invalid magnitude filter: The minimum cannot be greater than the maximum.", TITLE, StdIcon_Error, StdButton_Ok )).execute();
            return false;
         }
      return true;
   };

   this.GetEditControls = function( parent )
   {
      return (this.filters != null) ? this.GetMagnitudeFilterControls( parent ) : [];
   };

   // Removes objects that are in the same position with the given tolerance
   this.RemoveDuplicates = function( objects, tolerance )
   {
      objects.sort(  function( a, b )
                     {
                        return (a.posRD.y < b.posRD.y) ? -1 : ((a.posRD.y > b.posRD.y) ? 1 : 0);
                     } );

      let duplicate = 0;
      for ( let i = 0; i < objects.length; ++i )
      {
         let a = objects[i];
         let posRD = a.posRD;
         let cosy = DMath.cos( posRD.y );
         for ( let j = i + 1; j < objects.length; )
         {
            let b = objects[j];
            let dy = Math.abs( b.posRD.y - posRD.y );
            if ( dy > tolerance )
               break;
            let dx = Math.abs( b.posRD.x - posRD.x )*cosy;
            if ( dx < tolerance )
            {
               if ( a.magnitude > b.magnitude )
                  objects[i] = b;
               objects.splice( j, 1 );
               duplicate++;
            }
            else
               j++;
         }
      }
      console.writeln( format( "Removed %d duplicate objects", duplicate ) );
   };
}

VizierCatalog.prototype = new Catalog;

VizierCatalog.mirrors = [
   { address:"https://vizier.cds.unistra.fr/"          , name:"VizieR at CDS: Strasbourg, France" },
   { address:"http://vizier.nao.ac.jp/vizier/"         , name:"ADAC: Tokyo, Japan" },
   { address:"http://vizier.hia.nrc.ca/vizier/"        , name:"CADC: Victoria, Canada" },
   { address:"http://vizier.ast.cam.ac.uk/vizier/"     , name:"Cambridge: UK" },
   { address:"https://vizier.iucaa.in/vizier/"         , name:"IUCAA: Pune, India" },
   { address:"https://vizier.inasan.ru/vizier/"        , name:"INASAN: Moscow, Russia" },
   { address:"http://vizier.china-vo.org/vizier/"      , name:"NAOC: Beijng, China" },
   { address:"https://vizier.cfa.harvard.edu/vizier/"  , name:"CFA Harvard: Cambridge, USA" },
   { address:"http://www.ukirt.hawaii.edu/vizier/"     , name:"JAC: Hilo, Hawaii, USA" },
   { address:"http://vizier.idia.ac.za/vizier/"        , name:"IDIA: IDIA, South Africa" }
];

// ******************************************************************
// HR_Catalog
// ******************************************************************

function HR_Catalog()
{
   this.description = "Bright Star Catalog, 5th ed. (Hoffleit+, 9110 stars)";

   this.__base__ = VizierCatalog;
   this.__base__( "BrightStars", "Bright Stars" );

   this.catalogMagnitude = 7;
   this.magMin = NULLMAG;
   this.magMax = 7;
   this.fields = [ "Name", "Coordinates", "HR", "HD", "DM", "SAO", "Vmag", "B-V", "U-B", "R-I", "SpType" ];

   this.properties.push( ["magMin", DataType_Double] );
   this.properties.push( ["magMax", DataType_Double] );
   this.properties.push( ["magnitudeFilter", DataType_UCString] );

   this.filters = ["Vmag"];
   this.magnitudeFilter = "Vmag";

   this.GetConstructor = function()
   {
      return "new HR_Catalog()";
   };

   this.UrlBuilder = function( center, fov, mirrorServer )
   {
      return mirrorServer + "viz-bin/asu-tsv?-source=V/50/catalog&-c=" +
         format( "%f %f",center.x, center.y ) +
         "&-c.r=" + format( "%f", fov ) +
         "&-c.u=deg&-out.form=|" +
         "&-out.add=_RAJ,_DEJ&-out=pmRA&-out=pmDE&-out=Name&-out=HR&-out=HD&-out=DM&-out=SAO" +
         "&-out=Vmag&-out=B-V&-out=U-B&-out=R-I&-out=SpType" +
         this.CreateMagFilter( this.magnitudeFilter, this.magMin, this.magMax );
   };

   this.ParseRecord = function( tokens )
   {
      if ( tokens.length >= 14 && parseFloat( tokens[0] ) > 0 )
      {
         let x = parseFloat( tokens[0] );
         let y = parseFloat( tokens[1] );
         if ( !(x >= 0 && x <= 360 && y >= -90 && y <= 90) )
            return null;

         if ( this.position != null )
         {
            let pmX = parseFloat( tokens[2] ) * 1000 * Math.cos( Math.rad( y ) ); // mas/year * cos(delta)
            let pmY = parseFloat( tokens[3] ) * 1000; // mas/year
            let q = this.placeFunction( this.position, new StarPosition( x, y, pmX, pmY ) );
            x = Math.deg( q[0] );
            y = Math.deg( q[1] );
         }
         let name = tokens[4].trim();
         if ( name == null || name.length == 0 )
            name = "HR" + tokens[5].trim();
         let record = new CatalogRecord( new Point( x, y ), 0/*diameter*/, name, parseFloat( tokens[9] ) );
         record["HR"] = "HR"+tokens[5].trim();
         record["HD"] = "HD"+tokens[6].trim();
         record["DM"] = tokens[7].trim();
         record["SAO"] = "SAO"+tokens[8].trim();
         record["Vmag"] = tokens[9].trim();
         record["B-V"] = tokens[10].trim();
         record["U-B"] = tokens[11].trim();
         record["R-I"] = tokens[12].trim();
         record["SpType"] = tokens[13].trim();
         if ( record[this.magnitudeFilter] )
            record.magnitude = parseFloat( record[this.magnitudeFilter] );

         return record;
      }

      return null;
   };
}

HR_Catalog.prototype = new VizierCatalog;

__catalogRegister__.Register( new HR_Catalog );

// ******************************************************************
// HDCrossRefCatalog
// ******************************************************************

function HDCrossRefCatalog()
{
   this.description = "HD Cross-Reference (with data from All-sky Compiled Catalogue of 2.5 million stars (Kharchenko+ 2009))";

   this.__base__ = VizierCatalog;
   this.__base__( "HD_CrossReference", "HD Cross-Reference" );

   this.catalogMagnitude = 14;
   this.magMin = NULLMAG;
   this.magMax = 14;
   this.fields = [ "Name", "Coordinates", "Vmag", "ASCC" ];

   this.properties.push( ["magMin", DataType_Double] );
   this.properties.push( ["magMax", DataType_Double] );
   this.properties.push( ["magnitudeFilter", DataType_UCString] );

   this.filters = ["Vmag"];
   this.magnitudeFilter = "Vmag";

   this.GetConstructor = function()
   {
      return "new HDCrossRefCatalog()";
   };

   this.UrlBuilder = function( center, fov, mirrorServer )
   {
      return mirrorServer + "viz-bin/asu-tsv?-source=I/280B/ascc&-c=" +
         format( "%f %f",center.x, center.y ) +
         "&-c.r=" + format( "%f", fov ) +
         "&-c.u=deg&-out.form=|" +
         format( "&-out.max=%d", this.maxRecords ) +
         "&-out.add=recno&-out=_RA.icrs,_DE.icrs&-out=pmRA&-out=pmDE&-out=Vmag&-out=HD&-out=ASCC" +
         this.CreateMagFilter( this.magnitudeFilter, this.magMin, this.magMax );
   };

   this.ParseRecord = function( tokens )
   {
      if ( tokens.length >= 7 && parseFloat( tokens[0] ) > 0 && parseInt( tokens[5] ) < 99999 && parseInt( tokens[6] ) > 0 )
      {
         let x = parseFloat( tokens[1] );
         let y = parseFloat( tokens[2] );
         if ( !(x >= 0 && x <= 360 && y >= -90 && y <= 90) )
            return null;

         if ( this.position != null )
         {
            let pmX = parseFloat( tokens[3] ); // mas/year * cos(delta)
            let pmY = parseFloat( tokens[4] ); // mas/year
            let q = this.placeFunction( this.position, new StarPosition( x, y, pmX, pmY ) );
            x = Math.deg( q[0] );
            y = Math.deg( q[1] );
         }
         let name = "HD" + tokens[6].trim();
         let record = new CatalogRecord( new Point( x, y ), 0/*diameter*/, name, parseFloat( tokens[5] ) );
         record["Vmag"] = tokens[5].trim();
         if ( tokens.length > 7 )
            record["ASCC"] = tokens[7].trim();
         return record;
      }

      return null;
   };
}

HDCrossRefCatalog.prototype = new VizierCatalog;

__catalogRegister__.Register( new HDCrossRefCatalog );

// ******************************************************************
// HipparcosCatalog
// ******************************************************************

function HipparcosCatalog()
{
   this.description = "Hipparcos Main catalog (118,218 stars)";

   this.__base__ = VizierCatalog;
   this.__base__( "Hipparcos", "Hipparcos" );

   this.catalogMagnitude = 14;

   this.fields = [ "Name", "Coordinates", "Magnitude", "BT magnitude", "VT magnitude", "B-V color", "V-I index", "Spectral type", "Parallax" ];

   this.properties.push( ["magMin", DataType_Double] );
   this.properties.push( ["magMax", DataType_Double] );
   this.properties.push( ["magnitudeFilter", DataType_UCString ] );

   this.filters = [ "VTmag", "BTmag" ];
   this.magnitudeFilter = "VTmag";

   this.GetConstructor = function()
   {
      return "new HipparcosCatalog()";
   };

   this.UrlBuilder = function( center, fov, mirrorServer )
   {
      return mirrorServer + "viz-bin/asu-tsv?-source=I/239/hip_main&-c=" +
         format( "%f %f", center.x, center.y ) +
         "&-c.eq=J2000&-c.r=" + format( "%f", fov ) +
         "&-c.u=deg&-out.form=|" +
         format( "&-out.max=%d", this.maxRecords ) +
         "&-out.add=_RAJ,_DEJ&-out=HIP&-out=Vmag&-out=Plx&-out=pmRA&-out=pmDE&-out=BTmag&-out=VTmag&-out=B-V&-out=V-I&-out=SpType" +
         this.CreateMagFilter( this.magnitudeFilter, this.magMin, this.magMax );
   };

   this.ParseRecord = function( tokens )
   {
      if ( tokens.length >= 12 && parseFloat( tokens[0] ) > 0 )
      {
         let x = parseFloat( tokens[0] );
         let y = parseFloat( tokens[1] );
         if ( !(x >= 0 && x <= 360 && y >= -90 && y <= 90) )
            return null;

         if ( this.position != null )
         {
            let pmX = parseFloat( tokens[5] ); // mas/year * cos(delta)
            let pmY = parseFloat( tokens[6] ); // mas/year
            let q = this.placeFunction( this.position, new StarPosition( x, y, pmX, pmY ) );
            x = Math.deg( q[0] );
            y = Math.deg( q[1] );
         }
         let name = "HIP" + tokens[2].trim();
         let record = new CatalogRecord( new Point( x, y ), 0/*diameter*/, name, parseFloat( tokens[3] ) );
         record["BT magnitude"]=tokens[7].trim();
         record["VT magnitude"]=tokens[8].trim();
         record["B-V color"]=tokens[9].trim();
         record["V-I index"]=tokens[10].trim();
         record["Spectral type"]=tokens[11].trim();
         record["Parallax"]=tokens[4].trim();
         if ( record[this.magnitudeFilter] )
            record.magnitude = parseFloat( record[this.magnitudeFilter] );

         return record;
      }

      return null;
   };
}

HipparcosCatalog.prototype = new VizierCatalog;

__catalogRegister__.Register( new HipparcosCatalog );

// ******************************************************************
// TychoCatalog
// ******************************************************************

function TychoCatalog()
{
   this.description = "Tycho-2 catalog (2,539,913 stars)";

   this.__base__ = VizierCatalog;
   this.__base__( "TYCHO-2", "TYCHO-2" );

   this.catalogMagnitude = 16;

   this.fields = [ "Name", "Coordinates", "Magnitude", "VTmag", "BTmag", "HIP", "Vmag", "Bmag", "B-V index" ];

   this.properties.push( ["magMin", DataType_Double] );
   this.properties.push( ["magMax", DataType_Double] );
   this.properties.push( ["magnitudeFilter", DataType_UCString ] );

   this.filters = [ "VTmag", "BTmag" ];
   this.magnitudeFilter = "VTmag";

   this.GetConstructor = function()
   {
      return "new TychoCatalog()";
   };

   this.UrlBuilder = function( center, fov, mirrorServer )
   {
      return mirrorServer + "viz-bin/asu-tsv?-source=I/259/tyc2&-c=" +
         format( "%f %f", center.x, center.y ) +
         "&-c.r=" + format( "%f", fov ) +
         "&-c.u=deg&-out.form=|" +
         format( "&-out.max=%d", this.maxRecords ) +
         "&-out=TYC1&-out=TYC2&-out=TYC3&-out=RAmdeg&-out=DEmdeg&-out=pmRA&-out=pmDE&-out=VTmag&-out=BTmag&-out=HIP" +
         this.CreateMagFilter( this.magnitudeFilter, this.magMin, this.magMax );
   };

   this.ParseRecord = function( tokens )
   {
      if ( tokens.length >= 5 && parseFloat( tokens[0] ) > 0 )
      {
         let x = parseFloat( tokens[3] );
         let y = parseFloat( tokens[4] );
         if ( !(x >= 0 && x <= 360 && y >= -90 && y <= 90) )
            return null;

         if ( this.position != null )
         {
            let pmX = parseFloat( tokens[5] ); // mas/year * cos(delta)
            let pmY = parseFloat( tokens[6] ); // mas/year
            let q = this.placeFunction( this.position, new StarPosition( x, y, pmX, pmY ) );
            x = Math.deg( q[0] );
            y = Math.deg( q[1] );
         }
         let name = "TYC" + tokens[0].trim() + "-" + tokens[1].trim() + "-" + tokens[2].trim();
         let record = new CatalogRecord( new Point( x, y ), 0/*diameter*/, name, parseFloat( tokens[7] ) );
         record.VTmag = tokens[7];
         record.BTmag = tokens[8];
         if ( tokens[9] )
            record.HIP = "HIP" + tokens[9].trim();
         if ( tokens[7].trim().length > 0 && tokens[8].trim().length > 0 )
         {
            let VT = parseFloat( tokens[7] );
            let BT = parseFloat( tokens[8] );
            let V = VT - 0.090*(BT - VT);
            let BV = 0.850*(BT - VT);
            let B = BV + V;
            record.Vmag = format( "%.3f", V );
            record.Bmag = format( "%.3f", B );
            record["B-V index"] = format( "%.3f", BV );
         }
         if ( record[this.magnitudeFilter] )
            record.magnitude = parseFloat( record[this.magnitudeFilter] );

         return record;
      }

      return null;
   };
}

TychoCatalog.prototype = new VizierCatalog;

__catalogRegister__.Register( new TychoCatalog );

// ******************************************************************
// PGCCatalog
// ******************************************************************

function PGCCatalog()
{
   this.description = "PGC HYPERLEDA I catalog of galaxies (Paturel+, 2003) (983,261 galaxies)";

   this.__base__ = VizierCatalog;
   this.__base__( "PGC", "PGC" );

   this.fields = [ "Name", "Coordinates" ];

   this.GetConstructor = function()
   {
      return "new PGCCatalog()";
   };

   this.UrlBuilder = function(center, fov, mirrorServer)
   {
      return mirrorServer + "viz-bin/asu-tsv?-source=VII/237/pgc&-c=" +
         format( "%f %f", center.x, center.y ) +
         "&-c.r=" + format( "%f", fov ) +
         "&-c.u=deg&-out.form=|" +
         format( "&-out.max=%d", this.maxRecords ) +
         "&-out=PGC&-out=RAJ2000&-out=DEJ2000&-out=logD25&-out=logR25&-out=PA";
   };

   this.ParseRecord = function( tokens )
   {
      if ( tokens.length >= 6 && parseFloat( tokens[0] ) > 0 )
      {
         let x = DMSangle.FromString( tokens[1] ).GetValue()*15;
         let y = DMSangle.FromString( tokens[2] ).GetValue();
         if ( !(x >= 0 && x <= 360 && y >= -90 && y <= 90) )
            return null;
         if ( this.position != null )
         {
            let q = this.placeFunction( this.position, new StarPosition( x, y ) );
            x = Math.deg( q[0] );
            y = Math.deg( q[1] );
         }
         let diameter = (tokens[3].trim().length > 0) ? Math.pow10( parseFloat( tokens[3] ) )/60/10 : undefined;
         let axisRatio = (tokens[4].trim().length > 0) ? Math.pow10( parseFloat( tokens[4] ) ) : undefined;
         let posAngle = (tokens[5].trim().length > 0) ? parseFloat( tokens[5] ) : undefined;
         return new CatalogRecord( new Point( x, y ), diameter, "PGC" + tokens[0].trim(),
                                   undefined/*magnitude*/, axisRatio, posAngle );
      }

      return null;
   };
}

PGCCatalog.prototype = new VizierCatalog;

__catalogRegister__.Register( new PGCCatalog );

// ******************************************************************
// MilliquasCatalog
// ******************************************************************

function MilliquasCatalog()
{
   this.description = "The Million Quasars (Milliquas) catalogue, version 7.2 (Flesch, 2021) (1,573,824 objects)";

   this.__base__ = VizierCatalog;
   this.__base__( "Milliquas", "Milliquas" );

   this.fields = [ "Name", "Coordinates", "Type", "Rmag", "Bmag", "Redshift" ];

   this.GetConstructor = function()
   {
      return "new MilliquasCatalog()";
   };

   this.UrlBuilder = function(center, fov, mirrorServer)
   {
      return mirrorServer + "viz-bin/asu-tsv?-source=VII/290/catalog&-c=" +
         format( "%f %f", center.x, center.y ) +
         "&-c.r=" + format( "%f", fov ) +
         "&-c.u=deg&-out.form=|" +
         format( "&-out.max=%d", this.maxRecords ) +
         "&-out=Name&-out=RAJ2000&-out=DEJ2000&-out=Type&-out=Rmag&-out=Bmag&-out=z";
   };

   this.ParseRecord = function( tokens )
   {
      if ( tokens.length >= 7 && tokens[0].length > 0 )
      {
         let x = parseFloat( tokens[1] );
         let y = parseFloat( tokens[2] );
         if ( !(x >= 0 && x <= 360 && y >= -90 && y <= 90) )
            return null;
         if ( this.position != null )
         {
            let q = this.placeFunction( this.position, new StarPosition( x, y ) );
            x = Math.deg( q[0] );
            y = Math.deg( q[1] );
         }
         let name = tokens[0].trim();
         if ( name.startsWith( 'J' ) ) // JHHMMSS.SS+DDMMSS.S
            if ( name[1] == '0' || name[1] == '1' || name[1] == '2' )
               if ( name[10] == '+' || name[10] == '-' )
                  name = "MQ " + name;
         let record = new CatalogRecord( new Point( x, y ), 0/*diameter*/, name );
         record["Type"] = tokens[3].trim();
         record["Rmag"] = tokens[4].trim();
         record["Bmag"] = tokens[5].trim();
         record["Redshift"] = tokens[6].trim();
         return record;
      }

      return null;
   };
}

MilliquasCatalog.prototype = new VizierCatalog;

__catalogRegister__.Register( new MilliquasCatalog );

// ******************************************************************
// LBNCatalog
// ******************************************************************

function LBNCatalog()
{
   this.description = "Lynds' Catalogue of Bright Nebulae (Lynds, 1965) (1125 objects)";

   this.__base__ = VizierCatalog;
   this.__base__( "LBN", "LBN" );

   this.fields = [ "Name", "Other name", "Coordinates" ];

   this.GetConstructor = function()
   {
      return "new LBNCatalog()";
   };

   this.UrlBuilder = function(center, fov, mirrorServer)
   {
      return mirrorServer + "viz-bin/asu-tsv?-source=VII/9/catalog&-c=" +
         format( "%f %f", center.x, center.y ) +
         "&-c.r=" + format( "%f", fov ) +
         "&-c.u=deg&-out.form=|" +
         format( "&-out.max=%d", this.maxRecords ) +
         "&-out=recno&-out=Seq&-out=Diam1&-out=Name&-out=_RA.icrs&-out=_DE.icrs";
   };

   this.ParseRecord = function( tokens )
   {
      if ( tokens.length >= 6 && parseInt( tokens[0] ) > 0 )
      {
         let x = DMSangle.FromString( tokens[4] ).GetValue()*15;
         let y = DMSangle.FromString( tokens[5] ).GetValue();
         if ( !(x >= 0 && x <= 360 && y >= -90 && y <= 90) )
            return null;
         if ( this.position != null )
         {
            let q = this.placeFunction( this.position, new StarPosition( x, y ) );
            x = Math.deg( q[0] );
            y = Math.deg( q[1] );
         }
         let diameter = parseFloat( tokens[2] )/60;
         let record = new CatalogRecord( new Point( x, y ), diameter, "LBN " + tokens[1].trim() );
         record["Other name"] = tokens[3].trim();
         return record;
      }

      return null;
   };
}

LBNCatalog.prototype = new VizierCatalog;

__catalogRegister__.Register( new LBNCatalog );

// ******************************************************************
// LDNCatalog
// ******************************************************************

function LDNCatalog()
{
   this.description = "Lynds' Catalogue of Dark Nebulae (Lynds, 1962) (1791 objects)";

   this.__base__ = VizierCatalog;
   this.__base__( "LDN", "LDN" );

   this.fields = [ "Name", "Coordinates" ];

   this.GetConstructor = function()
   {
      return "new LDNCatalog()";
   };

   this.UrlBuilder = function(center, fov, mirrorServer)
   {
      return mirrorServer + "viz-bin/asu-tsv?-source=VII/7A/ldn&-c=" +
         format( "%f %f", center.x, center.y ) +
         "&-c.r=" + format( "%f", fov ) +
         "&-c.u=deg&-out.form=|" +
         format( "&-out.max=%d", this.maxRecords ) +
         "&-out=recno&-out=LDN&-out=Area&-out=_RA.icrs&-out=_DE.icrs";
   };

   this.ParseRecord = function( tokens )
   {
      if ( tokens.length >= 5 && parseInt( tokens[0] ) > 0 )
      {
         let x = DMSangle.FromString( tokens[3] ).GetValue()*15;
         let y = DMSangle.FromString( tokens[4] ).GetValue();
         if ( !(x >= 0 && x <= 360 && y >= -90 && y <= 90) )
            return null;
         if ( this.position != null )
         {
            let q = this.placeFunction( this.position, new StarPosition( x, y ) );
            x = Math.deg( q[0] );
            y = Math.deg( q[1] );
         }
         let diameter = Math.sqrt( parseFloat( tokens[2] ) );
         return new CatalogRecord( new Point( x, y ), diameter, "LDN " + tokens[1].trim() );
      }

      return null;
   };
}

LDNCatalog.prototype = new VizierCatalog;

__catalogRegister__.Register( new LDNCatalog );

// ******************************************************************
// CGPNCatalog
// ******************************************************************

function CGPNCatalog()
{
   this.description = "Catalogue of Galactic Planetary Nebulae (Kohoutek, 2001) (1759 objects)";

   this.__base__ = VizierCatalog;
   this.__base__( "CGPN", "CGPN" );

   this.fields = [ "Name", "Other name", "Coordinates" ];

   this.GetConstructor = function()
   {
      return "new CGPNCatalog()";
   };

   this.UrlBuilder = function(center, fov, mirrorServer)
   {
      return mirrorServer + "viz-bin/asu-tsv?-source=IV/24/table4&-c=" +
         format( "%f %f", center.x, center.y ) +
         "&-c.r=" + format( "%f", fov ) +
         "&-c.u=deg&-out.form=|" +
         format( "&-out.max=%d", this.maxRecords ) +
         "&-out=recno&-out=PK&-out=Name&-out=RAJ2000&-out=DEJ2000";
   };

   this.ParseRecord = function( tokens )
   {
      if ( tokens.length >= 5 && parseInt( tokens[0] ) > 0 )
      {
         let x = DMSangle.FromString( tokens[3] ).GetValue()*15;
         let y = DMSangle.FromString( tokens[4] ).GetValue();
         if ( !(x >= 0 && x <= 360 && y >= -90 && y <= 90) )
            return null;
         if ( this.position != null )
         {
            let q = this.placeFunction( this.position, new StarPosition( x, y ) );
            x = Math.deg( q[0] );
            y = Math.deg( q[1] );
         }
         let record = new CatalogRecord( new Point( x, y ), 0/*diameter*/, "PK" + tokens[1].trim() );
         record["Other name"] = tokens[2].trim();
         return record;
      }

      return null;
   };

   this.PostProcessObjects = function( objects )
   {
      /*
       * Table 4 of the CGPN contains multiple entries for most objects. Remove
       * all records with duplicate names keeping only the last one, which
       * usually provides the most accurate coordinates.
       */
      let o = objects.map( (x) => x ); // deep copy
      o.sort(
         function( a, b )
         {
            return (a.name < b.name) ? -1 : ((a.name > b.name) ? 1 : 0);
         } );
      o = o.filter(
         function( element, index, array )
         {
            return index == array.length-1 || element.name.length == 0 || element.name != array[index+1].name;
         } );

      // Mutate the function argument array.
      objects.length = 0;
      for ( let i = 0; i < o.length; ++i )
         objects.push( o[i] );
   };
}

CGPNCatalog.prototype = new VizierCatalog;

__catalogRegister__.Register( new CGPNCatalog );

// ******************************************************************
// PPMXCatalog
// ******************************************************************

function PPMXCatalog()
{
   this.description = "PPMX catalog";

   this.__base__ = VizierCatalog;
   this.__base__( "PPMX", "PPMX" );

   this.catalogMagnitude = 15;
   this.magMin = NULLMAG;
   this.magMax = 15;
   this.fields = [ "Name", "Coordinates", "Cmag", "Rmag", "Bmag", "Vmag", "Jmag", "Hmag", "Kmag" ];

   this.properties.push( ["magMin",DataType_Double] );
   this.properties.push( ["magMax",DataType_Double] );
   this.properties.push( ["magnitudeFilter", DataType_UCString ] );

   this.filters = [ "Cmag", "Rmag", "Bmag", "Vmag", "Jmag", "Hmag", "Kmag" ];
   this.magnitudeFilter = "Vmag";
   this.maxFov = 60;

   this.GetConstructor = function()
   {
      return "new PPMXCatalog()";
   };

   this.UrlBuilder = function(center, fov, mirrorServer)
   {
      return mirrorServer + "viz-bin/asu-tsv?-source=I/312/sample&-c=" +
         format( "%f %f", center.x, center.y ) +
         //"&-c.r=" + format( "%f",fov ) +
         "&-c.bd=" + format( "%f", fov ) +
         "&-c.u=deg&-out.form=|" +
         format( "&-out.max=%d", this.maxRecords ) +
         "&-out=PPMX&-out=RAJ2000&-out=DEJ2000&-out=pmRA&-out=pmDE&-out=Cmag&-out=Rmag&-out=Bmag&-out=Vmag&-out=Jmag&-out=Hmag&-out=Kmag" +
         this.CreateMagFilter( this.magnitudeFilter, this.magMin, this.magMax );
   };

   this.ParseRecord = function( tokens )
   {
      if ( tokens.length>=12 && parseFloat( tokens[1] )>0 ) {
         let x=parseFloat( tokens[1] );
         let y=parseFloat( tokens[2] );
         if ( !(x >= 0 && x <= 360 && y >= -90 && y <= 90) )
            return null;
         if ( this.position != null )
         {
            let pmX = parseFloat( tokens[3] ); // mas/year * cos(delta)
            let pmY = parseFloat( tokens[4] ); // mas/year
            let q = this.placeFunction( this.position, new StarPosition( x, y, pmX, pmY ) );
            x = Math.deg( q[0] );
            y = Math.deg( q[1] );
         }
         let record = new CatalogRecord( new Point( x, y ), 0/*diameter*/, tokens[0].trim(), parseFloat(tokens[6]) );
         record["Cmag"] = tokens[5].trim();
         record["Rmag"] = tokens[6].trim();
         record["Bmag"] = tokens[7].trim();
         record["Vmag"] = tokens[8].trim();
         record["Jmag"] = tokens[9].trim();
         record["Hmag"] = tokens[10].trim();
         record["Kmag"] = tokens[11].trim();
         if ( record[this.magnitudeFilter] )
            record.magnitude = parseFloat( record[this.magnitudeFilter] );
         return record;
      }

      return null;
   };
}

PPMXCatalog.prototype = new VizierCatalog;

__catalogRegister__.Register( new PPMXCatalog );

// ******************************************************************
// PPMXLCatalog
// ******************************************************************

function PPMXLCatalog()
{
   this.description = "PPMXL catalog (910,469,430 objects)";

   this.__base__ = VizierCatalog;
   this.__base__( "PPMXL", "PPMXL" );

   this.catalogMagnitude = 20;
   this.magMin = NULLMAG;
   this.magMax = 15;
   this.fields = [ "Name", "Coordinates", "Jmag", "Hmag", "Kmag", "b1mag", "b2mag", "r1mag", "r2mag", "imag" ];

   this.properties.push( ["magMin",DataType_Double] );
   this.properties.push( ["magMax",DataType_Double] );
   this.properties.push( ["magnitudeFilter", DataType_UCString ] );

   this.filters = [ "Jmag", "Hmag", "Kmag", "b1mag", "b2mag", "r1mag", "r2mag", "imag" ];
   this.magnitudeFilter = "r1mag";
   this.maxFov = 45;

   this.GetConstructor = function()
   {
      return "new PPMXLCatalog()";
   };

   this.UrlBuilder = function( center, fov, mirrorServer )
   {
      return mirrorServer + "viz-bin/asu-tsv?-source=I/317&-c=" +
         format( "%f %f", center.x, center.y ) +
         "&-c.r=" + format( "%f", fov ) +
         "&-c.u=deg&-out.form=|" +
         format( "&-out.max=%d", this.maxRecords ) +
         "&-out=PPMXL&-out=RAJ2000&-out=DEJ2000&-out=pmRA&-out=pmDE" +
         "&-out=Jmag&-out=Hmag&-out=Kmag&-out=b1mag&-out=b2mag&-out=r1mag&-out=r2mag&-out=imag" +
         this.CreateMagFilter( this.magnitudeFilter, this.magMin, this.magMax );
   };

   this.ParseRecord = function( tokens )
   {
      if ( tokens.length >= 13 && parseFloat( tokens[0] ) > 0 )
      {
         let x = parseFloat( tokens[1] );
         let y = parseFloat( tokens[2] );
         if ( !(x >= 0 && x <= 360 && y >= -90 && y <= 90) )
            return null;
         if ( this.position != null )
         {
            let pmX = parseFloat( tokens[3] ); // mas/year * cos(delta)
            let pmY = parseFloat( tokens[4] ); // mas/year
            let q = this.placeFunction( this.position, new StarPosition( x, y, pmX, pmY ) );
            x = Math.deg( q[0] );
            y = Math.deg( q[1] );
         }
         let record = new CatalogRecord( new Point( x, y ), 0/*diameter*/, tokens[0].trim(), parseFloat( tokens[10] ) );
         record.Jmag = tokens[5].trim();
         record.Hmag = tokens[6].trim();
         record.Kmag = tokens[7].trim();
         record.b1mag = tokens[8].trim();
         record.b2mag = tokens[9].trim();
         record.r1mag = tokens[10].trim();
         record.r2mag = tokens[11].trim();
         record.imag = tokens[12].trim();
         if ( record[this.magnitudeFilter] )
            record.magnitude = parseFloat( record[this.magnitudeFilter] );
         return record;
      }

      return null;
   };
}

PPMXLCatalog.prototype = new VizierCatalog;

__catalogRegister__.Register( new PPMXLCatalog );

// ******************************************************************
// USNOB1Catalog
// ******************************************************************

function USNOB1Catalog()
{
   this.description = "USNO-B1.0 catalog (1,045,175,762 objects)";

   this.__base__ = VizierCatalog;
   this.__base__( "USNO-B1", "USNO-B1" );

   this.catalogMagnitude = 20;
   this.magMax = 15;
   this.fields = [ "Name", "Coordinates", "B1mag", "B2mag", "R1mag", "R2mag", "Imag" ];

   this.properties.push( ["magMin",DataType_Double] );
   this.properties.push( ["magMax",DataType_Double] );
   this.properties.push( ["magnitudeFilter", DataType_UCString ] );

   this.filters = [ "B1mag", "B2mag", "R1mag", "R2mag", "Imag" ];
   this.magnitudeFilter = "R1mag";
   this.maxFov = 45;

   this.GetConstructor = function()
   {
      return "new USNOB1Catalog()";
   };

   this.UrlBuilder = function( center, fov, mirrorServer )
   {
      return mirrorServer + "viz-bin/asu-tsv?-source=I/284/out&-c=" +
         format( "%f %f", center.x, center.y ) +
         "&-c.r=" + format( "%f", fov ) +
         "&-c.u=deg&-out.form=|" +
         format( "&-out.max=%d", this.maxRecords ) +
         "&-out=USNO-B1.0&-out=RAJ2000&-out=DEJ2000&-out=pmRA&-out=pmDE" +
         "&-out=B1mag&-out=B2mag&-out=R1mag&-out=R2mag&-out=Imag" +
         this.CreateMagFilter( this.magnitudeFilter, this.magMin, this.magMax );
   };

   this.ParseRecord = function( tokens )
   {
      if ( tokens.length >= 8 && parseFloat( tokens[0] ) > 0 )
      {
         let x = parseFloat( tokens[1] );
         let y = parseFloat( tokens[2] );
         if ( !(x >= 0 && x <= 360 && y >= -90 && y <= 90) )
            return null;
         if ( this.position != null )
         {
            let pmX = parseFloat( tokens[3] ) * Math.cos( Math.rad( y ) ); // mas/year * cos(delta)
            let pmY = parseFloat( tokens[4] ); // mas/year
            let q = this.placeFunction( this.position, new StarPosition( x, y, pmX, pmY ) );
            x = Math.deg( q[0] );
            y = Math.deg( q[1] );
         }
         let record = new CatalogRecord( new Point( x, y ), 0/*diameter*/, "USNO "+tokens[0].trim(), parseFloat( tokens[7] ) );
         record.B1mag = tokens[5].trim();
         record.B2mag = tokens[6].trim();
         record.R1mag = tokens[7].trim();
         if ( tokens.length > 8 ) record.R2mag = tokens[8].trim();
         if ( tokens.length > 9 ) record.Imag = tokens[9].trim();
         if ( record[this.magnitudeFilter] )
            record.magnitude = parseFloat( record[this.magnitudeFilter] );
         return record;
      }

      return null;
   };
}

USNOB1Catalog.prototype = new VizierCatalog;

__catalogRegister__.Register( new USNOB1Catalog );

// ******************************************************************
// UCAC3Catalog
// ******************************************************************

function UCAC3Catalog()
{
   this.description = "UCAC3 catalog (100,765,502 objects)";

   this.__base__ = VizierCatalog;
   this.__base__( "UCAC3", "UCAC3" );

   this.catalogMagnitude = 15;
   this.magMax = 15;
   this.fields = [ "Name", "Coordinates", "Magnitude", "f.mag", "a.mag", "Jmag", "Hmag", "Kmag", "Bmag", "R2mag", "Imag" ];

   this.properties.push( ["magMin",DataType_Double] );
   this.properties.push( ["magMax",DataType_Double] );
   this.properties.push( ["magnitudeFilter", DataType_UCString] );

   this.filters = [ "f.mag", "a.mag", "Jmag", "Hmag", "Kmag", "Bmag", "R2mag", "Imag" ];
   this.magnitudeFilter = "f.mag";
   this.maxFov = 45;

   this.GetConstructor = function()
   {
      return "new UCAC3Catalog()";
   };

   this.UrlBuilder = function( center, fov, mirrorServer )
   {
      return mirrorServer + "viz-bin/asu-tsv?-source=I/315/out&-c=" +
         format( "%f %f", center.x, center.y ) +
         "&-c.r=" + format( "%f", fov ) +
         "&-c.u=deg&-out.form=|" +
         format( "&-out.max=%d", this.maxRecords ) +
         "&-out=3UC&-out=RAJ2000&-out=DEJ2000&-out=pmRA&-out=pmDE" +
         "&-out=f.mag&-out=a.mag&-out=Jmag&-out=Hmag&-out=Kmag&-out=Bmag&-out=R2mag&-out=Imag" +
         this.CreateMagFilter( this.magnitudeFilter, this.magMin, this.magMax );
   };

   this.ParseRecord = function( tokens )
   {
      if ( tokens.length >= 6 && parseFloat( tokens[0] ) > 0)
      {
         let x = parseFloat( tokens[1] );
         let y = parseFloat( tokens[2] );
         if ( !(x >= 0 && x <= 360 && y >= -90 && y <= 90) )
            return null;
         if ( this.position != null )
         {
            let pmX = parseFloat( tokens[3] ); // mas/year * cos(delta)
            let pmY = parseFloat( tokens[4] ); // mas/year
            let q = this.placeFunction( this.position, new StarPosition( x, y, pmX, pmY ) );
            x = Math.deg( q[0] );
            y = Math.deg( q[1] );
         }
         let record = new CatalogRecord( new Point( x, y ), 0/*diameter*/, "3UCAC" + tokens[0].trim(), parseFloat( tokens[5] ) );
         record["f.mag"] = tokens[5].trim();
         if ( tokens.length >  6 ) record["a.mag"] = tokens[6].trim();
         if ( tokens.length >  7 ) record.Jmag = tokens[7].trim();
         if ( tokens.length >  8 ) record.Hmag = tokens[8].trim();
         if ( tokens.length >  9 ) record.Kmag = tokens[9].trim();
         if ( tokens.length > 10 ) record.Bmag = tokens[10].trim();
         if ( tokens.length > 11 ) record.R2mag = tokens[11].trim();
         if ( tokens.length > 12 ) record.Imag = tokens[12].trim();
         if ( record[this.magnitudeFilter] )
            record.magnitude = parseFloat( record[this.magnitudeFilter] );
         return record;
      }

      return null;
   };
}

UCAC3Catalog.prototype = new VizierCatalog;

__catalogRegister__.Register( new UCAC3Catalog );

// ******************************************************************
// VdBCatalog
// ******************************************************************

function VdBCatalog()
{
   this.description = "Catalog of Reflection Nebulae - Van den Bergh (159 nebulaes)";

   this.__base__ = VizierCatalog;
   this.__base__( "VdB", "VdB" );

   this.catalogMagnitude = 10.5;

   this.fields = [ "Name", "Coordinates", "Magnitude", "DM code", "Type", "Surface bright.", "Spectral type" ];

   this.properties.push( ["magMin", DataType_Double] );
   this.properties.push( ["magMax", DataType_Double] );
   this.properties.push( ["magnitudeFilter", DataType_UCString] );

   this.filters = [ "Vmag" ];
   this.magnitudeFilter = "Vmag";

   this.GetConstructor = function()
   {
      return "new VdBCatalog()";
   };

   this.UrlBuilder = function(center, fov, mirrorServer)
   {
      return mirrorServer + "viz-bin/asu-tsv?-source=VII/21/catalog&-c=" +
         format( "%f %f", center.x, center.y ) +
         "&-c.eq=J2000&-c.r=" + format( "%f", fov ) +
         "&-c.u=deg&-out.form=|" +
         format( "&-out.max=%d", this.maxRecords ) +
         "&-out=_RA&-out=_DE&-out=VdB&-out=DM&-out=Vmag&-out=SpType&-out=Type&-out=SurfBr&-out=BRadMax&-out=RRadMax" +
         this.CreateMagFilter( "Vmag", this.magMin, this.magMax );
   };

   this.ParseRecord = function( tokens )
   {
      if ( tokens.length >= 10 && parseFloat( tokens[0] ) > 0 )
      {
         let x = parseFloat( tokens[0] );
         let y = parseFloat( tokens[1] );
         if ( !(x >= 0 && x <= 360 && y >= -90 && y <= 90) )
            return null;
         if ( this.position != null )
         {
            let q = this.placeFunction( this.position, new StarPosition( x, y ) );
            x = Math.deg( q[0] );
            y = Math.deg( q[1] );
         }
         let name = "VdB" + tokens[2].trim();
         let radBlue =  parseFloat( tokens[8] );
         let radRed =  parseFloat( tokens[9] );
         let radius = 0; // in arcmin
         if ( radBlue && radRed )
            radius = Math.max( radBlue, radRed );
         else if ( radRed )
            radius = radRed;
         else if ( radBlue )
            radius = radBlue;
         let record = new CatalogRecord( new Point( x, y ), radius*2/60, name, parseFloat( tokens[4] ) );
         record["DM code"] = tokens[3].trim();
         record["Type"] = tokens[6].trim();
         record["Surface brightness"] = tokens[7].trim();
         record["Spectral type"] = tokens[5].trim();
         return record;
      }

      return null;
   };
}

VdBCatalog.prototype = new VizierCatalog;

__catalogRegister__.Register( new VdBCatalog );

// ******************************************************************
// SharplessCatalog
// ******************************************************************

function SharplessCatalog()
{
   this.description = "Catalog of HII Regions - Sharpless (313 nebulaes)";

   this.__base__ = VizierCatalog;
   this.__base__( "Sharpless", "Sharpless" );

   this.fields = [ "Name", "Coordinates" ];

   this.GetConstructor = function()
   {
      return "new SharplessCatalog()";
   };

   this.UrlBuilder = function( center, fov, mirrorServer )
   {
      return mirrorServer + "viz-bin/asu-tsv?-source=VII/20/catalog&-c=" +
         format( "%f %f", center.x, center.y ) +
         "&-c.eq=J2000&-c.r=" + format( "%f", fov ) +
         "&-c.u=deg&-out.form=|" +
         "&-out.add=_RAJ,_DEJ&-out=Sh2&-out=Diam";
   };

   this.ParseRecord = function( tokens )
   {
      if ( tokens.length >= 4 && parseFloat( tokens[0] ) > 0 )
      {
         let x = parseFloat( tokens[0] );
         let y = parseFloat( tokens[1] );
         if ( !(x >= 0 && x <= 360 && y >= -90 && y <= 90) )
            return null;
         if ( this.position != null )
         {
            let q = this.placeFunction( this.position, new StarPosition( x, y ) );
            x = Math.deg( q[0] );
            y = Math.deg( q[1] );
         }
         let name = "Sh2-" + tokens[2].trim();
         let diam =  parseFloat( tokens[3] );
         if ( !diam )
            diam = 0;
         let record = new CatalogRecord( new Point( x, y ), diam/60, name );
         return record;
      }

      return null;
   };
}

SharplessCatalog.prototype = new VizierCatalog;

__catalogRegister__.Register( new SharplessCatalog );

// ******************************************************************
// BarnardCatalog
// ******************************************************************

function BarnardCatalog()
{
   this.description = "Barnard's Catalog of Dark Objects in the Sky (349 objects)";

   this.__base__ = VizierCatalog;
   this.__base__( "Barnard", "Barnard" );

   this.fields = [ "Name", "Coordinates" ];

   this.GetConstructor = function()
   {
      return "new BarnardCatalog()";
   };

   this.UrlBuilder = function( center, fov, mirrorServer )
   {
      return mirrorServer + "viz-bin/asu-tsv?-source=VII/220A/barnard&-c=" +
         format( "%f %f", center.x, center.y ) +
         "&-c.eq=J2000&-c.r=" + format( "%f", fov ) +
         "&-c.u=deg&-out.form=|" +
         "&-out.add=_RAJ,_DEJ&-out=Barn&-out=Diam";
   };

   this.ParseRecord = function( tokens )
   {
      if ( tokens.length >= 4 && parseFloat( tokens[0] ) > 0 )
      {
         let x = parseFloat( tokens[0] );
         let y = parseFloat( tokens[1] );
         if ( !(x >= 0 && x <= 360 && y >= -90 && y <= 90) )
            return null;
         if ( this.position != null )
         {
            let q = this.placeFunction( this.position, new StarPosition( x, y ) );
            x = Math.deg( q[0] );
            y = Math.deg( q[1] );
         }
         let name = "B" + tokens[2].trim();
         let diam =  parseFloat( tokens[3] );
         if ( !diam )
            diam = 0;
         let record = new CatalogRecord( new Point( x, y ), diam/60, name );
         return record;
      }

      return null;
   };
}

BarnardCatalog.prototype = new VizierCatalog;

__catalogRegister__.Register( new BarnardCatalog );

// ******************************************************************
// B-V White Balance Stars from NOMAD1
// ******************************************************************
// hacked by Troy Piggins from the Hipparcos function above.

function BVCatalog()
{
   this.description = "NOMAD-1 star catalog with B-V filtering for white balance";

   this.__base__ = VizierCatalog;
   this.__base__( "NOMAD-1", "NOMAD-1 B-V WB" );

   this.catalogMagnitude = 14;
   this.bvMin = 0.6;
   this.bvMax = 0.7;
   this.vrMin = 0.2;
   this.vrMax = 0.6;

   this.fields = [ "Name", "Coordinates", "Vmag", "Bmag", "Rmag", "B-V index", "V-R index" ];
   this.filters = [ "Vmag", "Bmag", "Rmag" ];
   this.magnitudeFilter = "Vmag";
   this.maxFov = 45;

   this.properties.push( ["magMin", DataType_Double] );
   this.properties.push( ["magMax", DataType_Double] );
   this.properties.push( ["bvMin", DataType_Double] );
   this.properties.push( ["bvMax", DataType_Double] );
   this.properties.push( ["vrMin", DataType_Double] );
   this.properties.push( ["vrMax", DataType_Double] );
   this.properties.push( ["magnitudeFilter", DataType_UCString] );

   this.GetConstructor = function()
   {
      return "new BVCatalog()";
   };

   this._base_GetEditControls = this.GetEditControls;
   this.GetEditControls = function( parent )
   {
      let controls = this._base_GetEditControls( parent );

      // B-V filter
      this.bv_Label = new Label( parent );
      this.bv_Label.text = "B-V filter:";
      this.bv_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;
      this.bv_Label.minWidth = parent.labelWidth1;

      this.bvMin_Edit = new Edit( parent );
      this.bvMin_Edit.setFixedWidth( parent.editWidth );
      if ( this.bvMin != NULLMAG )
         this.bvMin_Edit.text = format( "%g", this.bvMin );
      this.bvMin_Edit.toolTip = "<p>Draw only objects with a B-V index greater than this value.<br/>" +
         "It can be empty.</p>";
      this.bvMin_Edit.onTextUpdated = function( value )
      {
         if ( value != null && value.trim().length > 0 )
            this.dialog.activeFrame.object.catalog.bvMin = parseFloat(value);
         else
            this.dialog.activeFrame.object.catalog.bvMin = NULLMAG;
         this.dialog.activeFrame.object.catalog.bounds = null;
      };

      this.bvMax_Edit = new Edit( parent );
      this.bvMax_Edit.setFixedWidth( parent.editWidth );
      if ( this.bvMax != NULLMAG )
         this.bvMax_Edit.text = format( "%g", this.bvMax );
      this.bvMax_Edit.toolTip = "<p>Draw only objects with a B-V index lower than this value.<br />" +
         "It can be empty.</p>";
      this.bvMax_Edit.onTextUpdated = function( value )
      {
         if ( value != null && value.trim().length > 0 )
            this.dialog.activeFrame.object.catalog.bvMax = parseFloat( value );
         else
            this.dialog.activeFrame.object.catalog.bvMax = NULLMAG;
         this.dialog.activeFrame.object.catalog.bounds = null;
      };

      this.bvSeparator_Label = new Label( parent );
      this.bvSeparator_Label.text = " - ";

      // V-R filter
      this.vr_Label = new Label( parent );
      this.vr_Label.text = "V-R filter:";
      this.vr_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;

      this.vrMin_Edit = new Edit( parent );
      this.vrMin_Edit.setFixedWidth( parent.editWidth );
      if ( this.vrMin != NULLMAG )
         this.vrMin_Edit.text = format( "%g", this.vrMin );
      this.vrMin_Edit.toolTip = "<p>Draw only objects with a V-R index greater than this value.<br/>" +
         "It can be empty.</p>";
      this.vrMin_Edit.onTextUpdated = function( value )
      {
         if ( value != null && value.trim().length > 0 )
            this.dialog.activeFrame.object.catalog.vrMin = parseFloat( value );
         else
            this.dialog.activeFrame.object.catalog.vrMin = NULLMAG;
         this.dialog.activeFrame.object.catalog.bounds = null;
      };

      this.vrMax_Edit = new Edit( parent );
      this.vrMax_Edit.setFixedWidth( parent.editWidth );
      if ( this.vrMax != NULLMAG )
         this.vrMax_Edit.text = format( "%g", this.vrMax);
      this.vrMax_Edit.toolTip = "<p>Draw only objects with a V-R index lower than this value.<br />" +
         "It can be empty.</p>";
      this.vrMax_Edit.onTextUpdated = function( value )
      {
         if ( value != null && value.trim().length > 0 )
            this.dialog.activeFrame.object.catalog.vrMax = parseFloat( value );
         else
            this.dialog.activeFrame.object.catalog.vrMax = NULLMAG;
         this.dialog.activeFrame.object.catalog.bounds = null;
      };

      this.vrSeparator_Label = new Label( parent );
      this.vrSeparator_Label.text = " - ";

      let bvSizer = new HorizontalSizer;
      bvSizer.scaledSpacing = 4;
      bvSizer.add( this.bv_Label );
      bvSizer.add( this.bvMin_Edit );
      bvSizer.add( this.bvSeparator_Label );
      bvSizer.add( this.bvMax_Edit );
      bvSizer.addSpacing( 4 );
      bvSizer.add( this.vr_Label );
      bvSizer.add( this.vrMin_Edit );
      bvSizer.add( this.vrSeparator_Label );
      bvSizer.add( this.vrMax_Edit );
      bvSizer.addStretch();
      bvSizer.setAlignment( this.bvSeparator_Label, Align_Center );
      bvSizer.setAlignment( this.vrSeparator_Label, Align_Center );

      controls.push( bvSizer );
      return controls;
   };

   this.UrlBuilder = function( center, fov, mirrorServer )
   {
      let url = mirrorServer + "viz-bin/asu-tsv?-source=I/297&-c=" +
         format( "%f %f", center.x, center.y ) +
         "&-c.eq=J2000&-c.r=" + format( "%f", fov ) +
         "&-c.u=deg&-out.form=|" +
         format( "&-out.max=%d", this.maxRecords ) +
         "&-out.add=_RAJ,_DEJ&-out=NOMAD1&-out=Vmag&-out=Bmag&-out=Rmag&-out=pmRA&-out=pmDE&-out=R" +
         this.CreateMagFilter( this.magnitudeFilter,
                               (this.magMin == NULLMAG) ? -5 : this.magMin,
                               (this.magMax == NULLMAG) ? 25 : this.magMax );
      if ( this.magnitudeFilter != "Vmag" )
         url += this.CreateMagFilter( "Vmag", -5, 25 );
      if ( this.magnitudeFilter != "Bmag" )
         url += this.CreateMagFilter( "Bmag", -5, 25 );
      if ( this.magnitudeFilter != "Rmag" )
         url += this.CreateMagFilter( "Rmag", -5, 25 );

      return url;
   };

   this.ParseRecord = function( tokens )
   {
      if ( tokens.length >= 8 && parseFloat( tokens[0] ) > 0 )
      {
         let recommended = tokens[8].trim();
         // Exclude problematic stars
         if ( tokens[8].trim() == "*" )
            return null;

         // Get magnitude values
         let V = parseFloat( tokens[3] ); // Returns NaN if it doesn't exist
         let B = parseFloat( tokens[4] ); // Returns NaN if it doesn't exist
         let R = parseFloat( tokens[5] ); // Returns NaN if it doesn't exist

         // Calculate B-V
         let BV = B - V;

         // Calculate V-R
         let VR = V - R;

         // Filter by B-V index
         if ( this.bvMin != NULLMAG && BV < this.bvMin || this.bvMax != NULLMAG && BV > this.bvMax )
            return null;

         // Filter by V-R index
         if ( this.vrMin != NULLMAG && VR < this.vrMin || this.vrMax != NULLMAG && VR > this.vrMax )
            return null;

         let x = parseFloat( tokens[0] );
         let y = parseFloat( tokens[1] );
         if ( !(x >= 0 && x <= 360 && y >= -90 && y <= 90) )
            return null;
         if ( this.position != null )
         {
            let pmX = parseFloat( tokens[6] ); // mas/year * cos(delta)
            let pmY = parseFloat( tokens[7] ); // mas/year
            let q = this.placeFunction( this.position, new StarPosition( x, y, pmX, pmY ) );
            x = Math.deg( q[0] );
            y = Math.deg( q[1] );
         }
         let name = tokens[2].trim();
         let record = new CatalogRecord( new Point( x, y ), 0/*diameter*/, name, parseFloat( tokens[3] ) );
         record.Vmag = tokens[3].trim();
         record.Bmag = tokens[4].trim();
         record.Rmag = tokens[5].trim();
         record["B-V index"] = format( "%.3f", BV );
         record["V-R index"] = format( "%.3f", VR );
         return record;
      }

      return null;
   };
}

BVCatalog.prototype = new VizierCatalog;

__catalogRegister__.Register( new BVCatalog );

// ******************************************************************
// SDSSBase: Base class of SDSS catalog versions
// ******************************************************************

function SDSSBase( catalogId, catalogName )
{
   this.__base__ = VizierCatalog;
   this.__base__( catalogId, catalogName );

   this.catalogMagnitude = 25;

   this.fields = [ "Name", "Coordinates", "Magnitude", "Class", "Redshift", "umag", "gmag", "rmag", "imag", "zmag"];

   this.properties.push( ["magMin", DataType_Double] );
   this.properties.push( ["magMax", DataType_Double] );
   this.properties.push( ["magnitudeFilter", DataType_UCString ] );
   this.properties.push( ["classFilter", DataType_UInt16 ] );

   this.filters = [ "umag", "gmag", "rmag", "imag", "zmag" ];
   this.magnitudeFilter = "rmag";
   this.classFilter = 0;
   this.maxFov = 45;

   this._base_GetEditControls = this.GetEditControls;
   this.GetEditControls = function( parent )
   {
      let controls = this._base_GetEditControls( parent );

      // Class filter
      let class_Label = new Label( parent );
      class_Label.text = "Class:";
      class_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
      class_Label.minWidth = parent.labelWidth1;
      this.class_Label = class_Label;

      let class_Combo = new ComboBox( parent );
      class_Combo.editEnabled = false;
      class_Combo.toolTip = "<p>Filter the objects of the catalog by class.</p>";
      class_Combo.onItemSelected = function ()
      {
         this.dialog.activeFrame.object.catalog.classFilter = class_Combo.currentItem;
         this.dialog.activeFrame.object.catalog.bounds = null;
      };
      class_Combo.addItem( "All objects" );
      class_Combo.addItem( "Stars" );
      class_Combo.addItem( "Galaxies" );
      class_Combo.currentItem = this.classFilter;
      this.class_Combo = class_Combo;

      let classSizer = new HorizontalSizer;
      classSizer.scaledSpacing = 4;
      classSizer.add( class_Label );
      classSizer.add( class_Combo );
      classSizer.addStretch();
      this.classSizer = classSizer;

      controls.push( classSizer );
      return controls;
   };

   this.UrlBuilder = function( center, fov, mirrorServer )
   {
      let url = mirrorServer + "viz-bin/asu-tsv?-source=" + this.vizierSource + "&mode==1&-c=" +
         format( "%f %f",center.x, center.y ) +
         "&-c.r=" + format( "%f",fov ) +
         "&-c.u=deg&-out.form=|" +
         format( "&-out.max=%d", this.maxRecords ) +
         "&-oc.form=dec&-out.add=_RAJ,_DEJ" + "&-out=" + this.idField + "&-out=pmRA&-out=pmDE&-out=cl&-out=zsp" +
         "&-out=umag&-out=gmag&-out=rmag&-out=imag&-out=zmag" +
         this.CreateMagFilter( this.magnitudeFilter, this.magMin, this.magMax ) ;
      if ( this.classFilter == 1 )
         url += "&cl==6";
      else if ( this.classFilter == 2 )
         url += "&cl==3";
      return url;
   };

   this._base_GetCacheDescriptor = this.GetCacheDescriptor;
   this.GetCacheDescriptor = function()
   {
      let cacheId = this._base_GetCacheDescriptor();
      if ( this.classFilter == 1 )
         cacheId += "&cl==6";
      else if ( this.classFilter == 2 )
         cacheId += "&cl==3";
      return cacheId;
   };

   this.ParseRecord = function( tokens )
   {
      if ( tokens.length >= 12 && parseFloat( tokens[0] ) > 0 )
      {
         let x = parseFloat( tokens[0] );
         let y = parseFloat( tokens[1] );
         if ( !(x >= 0 && x <= 360 && y >= -90 && y <= 90) )
            return null;
         if ( this.position != null && tokens[3].trim().length > 0 && tokens[4].trim().length > 0 )
         {
            let pmX = parseFloat( tokens[3] ) * Math.cos( Math.rad( y ) ); // mas/year * cos(delta)
            let pmY = parseFloat( tokens[4] ); // mas/year
            let q = this.placeFunction( this.position, new StarPosition( x, y, pmX, pmY ) );
            x = Math.deg( q[0] );
            y = Math.deg( q[1] );
         }
         let record = new CatalogRecord( new Point( x, y ), 0/*diameter*/, "SDSS" + tokens[2].trim(), 0 );
         record.Redshift = tokens[6].trim();
         record.Class = tokens[5].trim();
         record.umag = tokens[7].trim();
         record.gmag = tokens[8].trim();
         record.rmag = tokens[9].trim();
         record.imag = tokens[10].trim();
         record.zmag = tokens[11].trim();
         record.magnitude = parseFloat( record[this.magnitudeFilter] );
         return record;
      }

      return null;
   };
}

SDSSBase.prototype = new VizierCatalog;

// ******************************************************************
// SDSSCatalog: Latest version of SDSS
// ******************************************************************

function SDSSCatalog()
{
   this.description = "SDSS R9 catalog (469,053,874 objects)";

   this.__base__ = SDSSBase;
   this.__base__( "SDSS", "SDSS R9" );

   this.vizierSource = "V/139"
   this.idField = "SDSS9";

   this.GetConstructor = function()
   {
      return "new SDSSCatalog()";
   };
}

SDSSCatalog.prototype = new SDSSBase;

__catalogRegister__.Register( new SDSSCatalog );

// ******************************************************************
// SDSS7Catalog: Release 7 of SDSS
// ******************************************************************

function SDSS7Catalog()
{
   this.name="SDSS7";
   this.description = "SDSS R7 catalog (357,175,411 objects)";

   this.__base__ = SDSSBase;
   this.__base__( "SDSS7", "SDSS R7");

   this.vizierSource = "II/294"
   this.idField = "SDSS";

   this.GetConstructor = function()
   {
      return "new SDSS7Catalog()";
   };
}

SDSS7Catalog.prototype = new SDSSBase;

__catalogRegister__.Register( new SDSS7Catalog );

// ******************************************************************
// GSCCatalog
// ******************************************************************

function GSCCatalog()
{
   this.description = "GSC2.3 catalog (945,592,683 objects)";

   this.__base__ = VizierCatalog;
   this.__base__( "GSC", "GSC" );

   this.catalogMagnitude = 23;

   this.fields = [ "Name", "Coordinates", "Magnitude", "Class", "Fmag", "jmag", "Vmag", "Nmag", "Umag", "Bmag"];

   this.properties.push( ["magMin", DataType_Double] );
   this.properties.push( ["magMax", DataType_Double] );
   this.properties.push( ["magnitudeFilter", DataType_UCString ] );
   this.properties.push( ["classFilter", DataType_UInt16 ] );

   this.filters = [ "Fmag", "jmag", "Vmag", "Nmag", "Umag", "Bmag" ];
   this.magnitudeFilter = "Vmag";
   this.classFilter = 0;

   this.GetConstructor = function()
   {
      return "new GSCCatalog()";
   };

   this._base_GetEditControls = this.GetEditControls;
   this.GetEditControls = function( parent )
   {
      let controls = this._base_GetEditControls( parent );

      // Class filter
      let class_Label = new Label( parent );
      class_Label.text = "Class:";
      class_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
      class_Label.minWidth = parent.labelWidth1;
      this.class_Label = class_Label;

      let class_Combo = new ComboBox( parent );
      class_Combo.editEnabled = false;
      class_Combo.toolTip = "<p>Filter the objects of the catalog by class.</p>";
      class_Combo.onItemSelected = function()
      {
         this.dialog.activeFrame.object.catalog.classFilter = class_Combo.currentItem;
         this.dialog.activeFrame.object.catalog.bounds = null;
      };
      class_Combo.addItem( "All objects" );
      class_Combo.addItem( "Star" );
      class_Combo.addItem( "Non-star" );
      class_Combo.currentItem = this.classFilter;
      this.class_Combo = class_Combo;

      let classSizer = new HorizontalSizer;
      classSizer.scaledSpacing = 4;
      classSizer.add( class_Label );
      classSizer.add( class_Combo );
      classSizer.addStretch();
      this.classSizer = classSizer;

      controls.push( classSizer );
      return controls;
   };

   this.UrlBuilder = function(center, fov, mirrorServer)
   {
      let url = mirrorServer + "viz-bin/asu-tsv?-source=I/305/out&-c=" +
         format( "%f %f", center.x, center.y ) +
         "&-c.r=" + format( "%f", fov ) +
         "&-c.u=deg&-out.form=|" +
         format( "&-out.max=%d", this.maxRecords ) +
         "&-out=GSC2.3&-out=RAJ2000&-out=DEJ2000&-out=Class" +
         "&-out=Fmag&-out=jmag&-out=Vmag&-out=Nmag&-out=Umag&-out=Bmag" +
         this.CreateMagFilter( this.magnitudeFilter, this.magMin, this.magMax ) ;
      if ( this.classFilter == 1 )
         url += "&Class==0";
      else if ( this.classFilter == 2 )
         url += "&Class==3";
      return url;
   };

   this._base_GetCacheDescriptor = this.GetCacheDescriptor;
   this.GetCacheDescriptor = function()
   {
      let cacheId = this._base_GetCacheDescriptor();
      if ( this.classFilter == 1 )
         cacheId += "&cl==6";
      else if ( this.classFilter == 2 )
         cacheId += "&cl==3";
      return cacheId;
   };

   this.ParseRecord = function( tokens )
   {
      if ( tokens.length >= 9 && parseFloat( tokens[1] ) > 0 )
      {
         let x = parseFloat( tokens[1] );
         let y = parseFloat( tokens[2] );
         if ( !(x >= 0 && x <= 360 && y >= -90 && y <= 90) )
            return null;
         if ( this.position != null )
         {
            let q = this.placeFunction( this.position, new StarPosition( x, y ) );
            x = Math.deg( q[0] );
            y = Math.deg( q[1] );
         }
         let record = new CatalogRecord( new Point( x, y ), 0/*diameter*/, tokens[0].trim(), 0 );
         record.Class = tokens[3].trim();
         record.Fmag = tokens[4].trim();
         record.jmag = tokens[5].trim();
         record.Vmag = tokens[6].trim();
         record.Nmag = tokens[7].trim();
         record.Umag = tokens[8].trim();
         if ( tokens.length > 9 )
            record.Bmag = tokens[9].trim();
         record.magnitude = parseFloat( record[this.magnitudeFilter] );
         return record;
      }

      return null;
   };
}

GSCCatalog.prototype = new VizierCatalog;

__catalogRegister__.Register( new GSCCatalog );

// ******************************************************************
// CMC14Catalog
// ******************************************************************

function CMC14Catalog()
{
   this.description = "CMC14 catalog (95,858,475 stars)";

   this.__base__ = VizierCatalog;
   this.__base__( "CMC14", "CMC14" );

   this.catalogMagnitude = 17;

   this.fields = [ "Name", "Coordinates", "Magnitude", "Class", "r'mag", "Jmag", "Hmag", "Ksmag" ];

   this.properties.push( ["magMin", DataType_Double] );
   this.properties.push( ["magMax", DataType_Double] );
   this.properties.push( ["magnitudeFilter", DataType_UCString ] );

   this.filters = [ "r'mag", "Jmag", "Hmag", "Ksmag" ];
   this.magnitudeFilter = "r'mag";
   this.classFilter = 0;

   this.GetConstructor = function()
   {
      return "new CMC14Catalog()";
   };

   this.UrlBuilder = function(center, fov, mirrorServer)
   {
      let url = mirrorServer + "viz-bin/asu-tsv?-source=I/304/out&-c=" +
         format( "%f %f",center.x, center.y ) +
         "&-c.r=" + format( "%f", fov ) +
         "&-c.u=deg&-out.form=|" +
         format( "&-out.max=%d", this.maxRecords )+
         "&-out=CMC14&-out=RAJ2000&-out=DEJ2000" +
         "&-out=r'mag&-out=Jmag&-out=Hmag&-out=Ksmag" +
         this.CreateMagFilter( this.magnitudeFilter, this.magMin, this.magMax ) ;
      return url;
   };

   this.ParseRecord = function( tokens )
   {
      if ( tokens.length >= 2 && parseFloat( tokens[1] ) > 0 )
      {
         let x = parseFloat( tokens[1] );
         let y = parseFloat( tokens[2] );
         if ( !(x >= 0 && x <= 360 && y >= -90 && y <= 90) )
            return null;
         if ( this.position != null )
         {
            let q = this.placeFunction( this.position, new StarPosition( x, y ) );
            x = Math.deg( q[0] );
            y = Math.deg( q[1] );
         }
         let record = new CatalogRecord( new Point( x, y ), 0/*diameter*/, tokens[0].trim(), 0 );
         if ( tokens.length > 3 ) record["r'mag"] = tokens[3].trim();
         if ( tokens.length > 4 ) record.Jmag = tokens[4].trim();
         if ( tokens.length > 5 ) record.Hmag = tokens[5].trim();
         if ( tokens.length > 6 ) record.Ksmag = tokens[6].trim();
         record.magnitude = parseFloat( record[this.magnitudeFilter] );
         return record;
      }

      return null;
   };
}

CMC14Catalog.prototype = new VizierCatalog;

__catalogRegister__.Register( new CMC14Catalog );

// ******************************************************************
// ARPCatalog
// ******************************************************************

function ARPCatalog()
{
   this.description = "ARP catalog (592 galaxies)";

   this.__base__ = VizierCatalog;
   this.__base__( "ARP", "ARP" );

   this.catalogMagnitude = 17;

   this.fields = [ "Name", "CommonName", "Coordinates", "Magnitude", "MType", "VTmag" ];

   this.properties.push( ["magMin", DataType_Double] );
   this.properties.push( ["magMax", DataType_Double] );
   this.properties.push( ["magnitudeFilter", DataType_UCString ] );

   this.filters = [ "VTmag" ];
   this.magnitudeFilter = "VTmag";

   this.GetConstructor = function()
   {
      return "new ARPCatalog()";
   };

   this.UrlBuilder = function(center, fov, mirrorServer)
   {
      let url=mirrorServer+"viz-bin/asu-tsv?-source=VII/192/arplist&-c=" +
         format("%f %f",center.x, center.y) +
         "&-c.r=" + format("%f",fov) +
         "&-c.u=deg&-out.form=|"+
         "&-oc.form=dec&-out.add=_RAJ,_DEJ"+
         "&-out=Arp&-out=Name&-out=VT&-out=dim1&-out=MType" +
         this.CreateMagFilter( this.magnitudeFilter, this.magMin, this.magMax ) ;
      return url;
   };

   this.ParseRecord = function( tokens )
   {
      if ( tokens.length >= 2 && parseFloat( tokens[0] ) > 0 )
      {
         let x = parseFloat( tokens[0] );
         let y = parseFloat( tokens[1] );
         if ( !(x >= 0 && x <= 360 && y >= -90 && y <= 90) )
            return null;
         if ( this.position != null )
         {
            let q = this.placeFunction( this.position, new StarPosition( x, y ) );
            x = Math.deg( q[0] );
            y = Math.deg( q[1] );
         }
         let diameter = parseFloat( tokens[5] )/60;
         let record = new CatalogRecord( new Point( x, y ), diameter, "ARP" + tokens[2].trim() );
         record["CommonName"] = tokens[3].trim();
         record["VTmag"] = tokens[4].trim();
         record["MType"] = tokens[6].trim();
         record.magnitude = parseFloat( record[this.magnitudeFilter] );
         return record;
      }

      return null;
   };
}

ARPCatalog.prototype = new VizierCatalog;

__catalogRegister__.Register( new ARPCatalog );

// ******************************************************************
// GCVS Catalog
// ******************************************************************

function GCVSCatalog()
{
   this.description = "General Catalog of Variable Stars (47969 stars)";

   this.__base__ = VizierCatalog;
   this.__base__( "GCVS", "GCVS" );

   this.catalogMagnitude = 17;

   this.fields = [ "Name", "Coordinates", "MaxMagnitude", "MinMagnitude1", "MinMagnitude2", "Period", "VarType", "SpectralType" ];

   this.properties.push( ["magMin", DataType_Double] );
   this.properties.push( ["magMax", DataType_Double] );
   this.properties.push( ["magnitudeFilter", DataType_UCString ] );

   this.filters = [ "magMax" ];
   this.magnitudeFilter = "magMax";

   this.GetConstructor = function()
   {
      return "new GCVSCatalog()";
   };

   this.UrlBuilder = function(center, fov, mirrorServer)
   {
      let url = mirrorServer + "viz-bin/asu-tsv?-source=B/gcvs/gcvs_cat&-c=" +
         format( "%f %f",center.x, center.y ) +
         "&-c.r=" + format( "%f",fov ) +
         "&-c.u=deg&-out.form=|" +
         "&-out=GCVS&-out=RAJ2000&-out=DEJ2000&-out=pmRA&-out=pmDE" +
         "&-out=VarType&-out=magMax&-out=Min1&-out=Min2&-out=Period&-out=SpType" +
         this.CreateMagFilter( this.magnitudeFilter, this.magMin, this.magMax ) ;
      return url;
   };

   this.ParseRecord = function( tokens )
   {
      if ( tokens.length >= 3 && parseFloat( tokens[1] ) > 0 )
      {
         let x = DMSangle.FromString( tokens[1] ).GetValue()*15;
         let y = DMSangle.FromString( tokens[2] ).GetValue();
         if ( !(x >= 0 && x <= 360 && y >= -90 && y <= 90) )
            return null;

         if ( this.position != null && tokens[3].trim().length > 0 && tokens[4].trim().length > 0 )
         {
            let pmX = parseFloat( tokens[3] ) * 1000 * Math.cos( Math.rad( y ) ); // mas/year * cos(delta)
            let pmY = parseFloat( tokens[4] ) * 1000; // mas/year
            let q = this.placeFunction( this.position, new StarPosition( x, y, pmX, pmY ) );
            x = Math.deg( q[0] );
            y = Math.deg( q[1] );
         }
         let record = new CatalogRecord( new Point( x, y ), 0/*diameter*/, tokens[0].trim(), parseFloat( tokens[6] ) );
         //record["Code"] = tokens[0].trim();
         record["MaxMagnitude"] = tokens[6].trim();
         record["MinMagnitude1"] = tokens[7].trim();
         record["MinMagnitude2"] = tokens[8].trim();
         record["Period"] = tokens[9].trim();
         if ( record["Period"].length )
            record["Period"] = parseFloat( record["Period"] ).toString();
         record["VarType"] = tokens[5].trim();
         record["SpectralType"] = tokens[10].trim();
         //record.magnitude = parseFloat( record[this.magnitudeFilter] );
         return record;
      }

      return null;
   };
}

GCVSCatalog.prototype = new VizierCatalog;

__catalogRegister__.Register( new GCVSCatalog );

// ******************************************************************
// GaiaDR1_Catalog
// ******************************************************************

function GaiaDR1_Catalog()
{
   this.description = "Gaia Data Release 1 (Gaia collaboration, 2016, 1,142,679,769 sources)";

   this.__base__ = VizierCatalog;
   this.__base__( "GaiaDR1", "Gaia DR1" );

   this.catalogMagnitude = 20.7;
   this.magMin = NULLMAG;
   this.magMax = 21;
   this.fields = [ "SourceID", "Coordinates", "<Gmag>" ];

   this.properties.push( ["magMin", DataType_Double] );
   this.properties.push( ["magMax", DataType_Double] );
   this.properties.push( ["magnitudeFilter", DataType_UCString ] );

   this.filters = [ "<Gmag>"];
   this.magnitudeFilter = "<Gmag>";

   this.GetConstructor = function ()
   {
      return "new GaiaDR1_Catalog()";
   };

   this.UrlBuilder = function( center, fov, mirrorServer )
   {
      let url = mirrorServer + "viz-bin/asu-tsv?-source=I/337/gaia&-c=" +
         format( "%f %f", center.x, center.y ) +
         "&-c.r=" + format( "%f", fov ) +
         "&-c.u=deg&-out.form=|" +
         "&-out.add=RA_ICRS,DE_ICRS&-out=pmRA&-out=pmDE&-out=Source&-out=<Gmag>" +
         this.CreateMagFilter( this.magnitudeFilter, this.magMin, this.magMax );
      return url;
   };

   this.ParseRecord = function( tokens )
   {
      if ( tokens.length >= 6 && parseFloat( tokens[0] ) > 0 )
      {
         let x = parseFloat( tokens[0] );
         let y = parseFloat( tokens[1] );
         if ( !(x >= 0 && x <= 360 && y >= -90 && y <= 90) )
            return null;
         if ( this.position != null && tokens[2].trim().length > 0 && tokens[3].trim().length > 0 )
         {
            let pmX = parseFloat( tokens[2] );
            let pmY = parseFloat( tokens[3] );
            let q = this.placeFunction( this.position,
                                        new StarPosition( x,   // ra (deg)
                                                          y,   // dec (deg)
                                                          pmX, // pmra*cos( dec ) (mas/yr)
                                                          pmY, // pmdec (mas/yr)
                                                          0,   // parallax (as)
                                                          0,   // radial velocity
                                                          2457023.75 /* 2015.0 */ ) );
            x = Math.deg( q[0] );
            y = Math.deg( q[1] );
         }
         let name = tokens[4].trim();
         let record = new CatalogRecord( new Point( x, y ), 0/*diameter*/, name, parseFloat( tokens[5] ) );
         record["SourceID"] = name;
         record["<Gmag>"] = tokens[5].trim();
         if ( record[this.magnitudeFilter] )
            record.magnitude = parseFloat( record[this.magnitudeFilter] );
         return record;
      }

      return null;
   };
}

GaiaDR1_Catalog.prototype = new VizierCatalog;

__catalogRegister__.Register( new GaiaDR1_Catalog );

// ******************************************************************
// GaiaDR2_Catalog
// ******************************************************************

function GaiaDR2_Catalog()
{
   this.description = "Gaia Data Release 2 (Gaia collaboration et al., 2018, 1,692,919,135 sources)";

   this.__base__ = VizierCatalog;
   this.__base__( "GaiaDR2", "Gaia DR2" );

   this.catalogMagnitude = 21;
   this.magMin = NULLMAG;
   this.magMax = 21;
   this.fields = [ "SourceID", "Coordinates", "RPmag", "Gmag", "BPmag", "Parallax", "RadialVelocity", "Radius", "Luminosity"];

   this.properties.push( ["magMin", DataType_Double] );
   this.properties.push( ["magMax", DataType_Double] );
   this.properties.push( ["magnitudeFilter", DataType_UCString ] );

   this.filters = ["RPmag", "Gmag", "BPmag"];
   this.magnitudeFilter = "Gmag";

   this.GetConstructor = function()
   {
      return "new GaiaDR2_Catalog()";
   };

   this.UrlBuilder = function( center, fov, mirrorServer )
   {
      let url = mirrorServer + "viz-bin/asu-tsv?-source=I/345/gaia2&-c=" +
         format( "%f %f", center.x, center.y ) +
         "&-c.r=" + format( "%f", fov ) +
         "&-c.u=deg&-out.form=|" +
         "&-out.add=RA_ICRS,DE_ICRS&-out=pmRA&-out=pmDE&-out=Source&-out=Gmag&-out=RPmag&-out=BPmag" +
         "&-out=Plx&-out=RV&-out=Rad&-out=Lum" +
         this.CreateMagFilter( this.magnitudeFilter, this.magMin, this.magMax );
      return url;
   };

   this.ParseRecord = function( tokens )
   {
      if ( tokens.length >= 5 && parseFloat( tokens[0] ) > 0 )
      {
         let x = parseFloat( tokens[0] );
         let y = parseFloat( tokens[1] );
         if ( !(x >= 0 && x <= 360 && y >= -90 && y <= 90) )
            return null;
         if ( this.position != null && tokens[2].trim().length > 0 && tokens[3].trim().length > 0 )
         {
            let pmX = parseFloat( tokens[2] );
            let pmY = parseFloat( tokens[3] );
            let plx = (tokens[8].trim().length > 0) ? Math.max( 0, parseFloat( tokens[8] )/1000 ) : 0;
            let q = this.placeFunction( this.position,
                                        new StarPosition( x,   // ra (deg)
                                                          y,   // dec (deg)
                                                          pmX, // pmra*cos( dec ) (mas/yr)
                                                          pmY, // pmdec (mas/yr)
                                                          plx, // parallax (as)
                                                          0,   // radial velocity
                                                          2457206.375 /* 2015.5 */ ) );
            x = Math.deg( q[0] );
            y = Math.deg( q[1] );
         }
         let name = tokens[4].trim();
         let record = new CatalogRecord( new Point( x, y ), 0/*diameter*/, name, parseFloat( tokens[5] ) );
         record["SourceID"] = name;
         record["Gmag"] = tokens[5].trim();
         record["RPmag"] = tokens[6].trim();
         record["BPmag"] = tokens[7].trim();
         record["Parallax"] = tokens[8].trim();
         record["RadialVelocity"] = tokens[9].trim();
         record["Radius"] = tokens[10].trim();
         record["Luminosity"] = tokens[11].trim();
         if ( record[this.magnitudeFilter] )
            record.magnitude = parseFloat( record[this.magnitudeFilter] );
         return record;
      }

      return null;
   };
}

GaiaDR2_Catalog.prototype = new VizierCatalog;

__catalogRegister__.Register( new GaiaDR2_Catalog );
__catalogRegister__.Register( new GaiaDR2_Catalog, "Gaia" );

// ******************************************************************
// Base class for Gaia catalogs implemented as local XPSD servers.
// ******************************************************************

function GaiaXPSDCatalogBase(  id, name, dataRelease, catalogEpoch )
{
   this.__base__ = CatalogWithMagnitudeFilters;
   this.__base__( id, name );

   this.hasXPSDServer = true;
   this.restrictToHQStars = false;
   this.position = null;
   this.bounds = null;
   this.coordinatePrecision = 2; // for annotations
   this.catalogMagnitude = 21;
   this.magMin = NULLMAG;
   this.magMax = 21;
   this.maxRecords = 200000;
   this.maxFov = null;
   this.fields = ["Coordinates", "RPmag", "Gmag", "BPmag", "Parallax", "Flags"];

   this.properties.push( ["magMin", DataType_Double] );
   this.properties.push( ["magMax", DataType_Double] );
   this.properties.push( ["magnitudeFilter", DataType_UCString ] );
   this.properties.push( ["coordinatePrecision", DataType_UInt8 ] );

   this.filters = ["RPmag", "Gmag", "BPmag"];
   this.magnitudeFilter = "Gmag";

   this.dataRelease = dataRelease;
   this.catalogEpoch = catalogEpoch;

   this.newXPSDServer = function()
   {
      if ( (typeof Gaia) == 'undefined' )
         throw new Error( "The Gaia process is not installed." );

      let server = new Gaia;
      server.dataRelease = this.dataRelease;
      server.magnitudeLow = (this.magMin == NULLMAG) ? -1.5 : this.magMin;
      server.magnitudeHigh = this.magMax;
      server.sourceLimit = this.maxRecords;
      // Exclude:
      //    - Sources without 5-parameter astrometric solutions.
      //    - For high quality, sources with low-quality position, proper motions or parallax.
      server.exclusionFlags = GaiaFlag_NoPM;
      server.inclusionFlags = this.restrictToHQStars ? GaiaFlag_GoodAstrometry : 0;
      server.sortBy = Gaia.prototype.SortBy_G;
      server.generateTextOutput = false;
      return server;
   };

   this.Load = function( metadata )
   {
      let server = this.newXPSDServer();
      server.command = "search";
      server.centerRA = metadata.ra;
      server.centerDec = metadata.dec;
      server.radius = metadata.SearchRadius();
      server.verbosity = 1; // minimal console information

      if ( !server.executeGlobal() )
         throw new Error( "Failure to execute XPSD server search command." );

      this.position = new Position( metadata.observationTime, "UTC" );
      if ( metadata.topocentric && metadata.obsLongitude != null && metadata.obsLatitude != null )
         this.position.observer = new ObserverPosition( metadata.obsLongitude, metadata.obsLatitude,
                                                        (metadata.obsHeight != null) ? metadata.obsHeight : 0 );
      let F = placeFunctionForReferenceSystem( metadata.referenceSystem );
      this.objects = [];
      for ( let S = server.sources, i = 0; i < S.length; ++i )
      {
         // 0   1    2     3     4      5     6      7      8
         // ra, dec, parx, pmra, pmdec, magG, magBP, magRP, flags
         let s = S[i];
         let q = F( this.position,
                    new StarPosition( s[0],        // ra (deg)
                                      s[1],        // dec (deg)
                                      s[3],        // pmra*cos( dec ) (mas/yr)
                                      s[4],        // pmdec (mas/yr)
                         Math.max( 0, s[2]/1000 ), // parallax (as)
                                      0,           // radial velocity
                                      this.catalogEpoch ) );

         let record = new CatalogRecord( new Point( Math.deg( q[0] ), Math.deg( q[1] ) ),
                                         0/*diameter*/, ''/*name*/, s[5]/*magG*/ );

         record["Parallax"] = format( "%.4f", s[2] );
         record["Gmag"] = format( "%.3f", s[5] );
         record["BPmag"] = format( "%.3f", s[6] );
         record["RPmag"] = format( "%.3f", s[7] );
         record["Flags"] = format( "%08x", s[8] );
         if ( record[this.magnitudeFilter] )
            record.magnitude = parseFloat( record[this.magnitudeFilter] );
         this.objects.push( record );
      }

      if ( metadata.ref_I_G )
      {
         let insideObjects = 0;
         for ( let i = 0; i < this.objects.length; ++i )
            if ( this.objects[i] )
            {
               let posI = metadata.Convert_RD_I( this.objects[i].posRD, true/*unscaled*/ );
               if ( posI
                 && posI.x > 0
                 && posI.y > 0
                 && posI.x < metadata.width
                 && posI.y < metadata.height )
               {
                  ++insideObjects;
               }
            }
         console.writeln( "<b>Catalog ", this.name, "</b>: ", insideObjects, " objects inside the image." );
      }
      else
         console.writeln( "<b>Catalog ", this.name, "</b>: ", this.objects.length, " objects." );
   };

   this.GetEditControls = function( parent )
   {
      let controls = this.GetMagnitudeFilterControls( parent );

      let precision_Label = new Label( parent );
      precision_Label.text = "Precision:";
      precision_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;
      precision_Label.minWidth = parent.labelWidth1;

      let precision_Combo = new ComboBox( parent );
      precision_Combo.editEnabled = false;
      precision_Combo.toolTip = "<p>Number of decimal digits to show on coordinate label.</p>";
      precision_Combo.onItemSelected = function()
      {
         this.dialog.activeFrame.object.catalog.coordinatePrecision = precision_Combo.currentItem;
      };
      precision_Combo.addItem( "0 (arcseconds)" );
      precision_Combo.addItem( "1 (0.1 arcseconds)" );
      precision_Combo.addItem( "2 (0.01 arcseconds)" );
      precision_Combo.addItem( "3 (milliarcseconds)" );
      precision_Combo.currentItem = Math.range( this.coordinatePrecision, 0, 3 );

      let precisionSizer = new HorizontalSizer;
      precisionSizer.scaledSpacing = 4;
      precisionSizer.add( precision_Label );
      precisionSizer.add( precision_Combo );
      precisionSizer.addStretch();

      controls.push( precisionSizer );
      return controls;
   };
}

GaiaXPSDCatalogBase.prototype = new CatalogWithMagnitudeFilters;

// ******************************************************************
// Gaia DR2 Local XPSD Server
// ******************************************************************

function GaiaDR2XPSDCatalog()
{
   this.description = "Gaia Data Release 2 - Local XPSD Server (Gaia collaboration et al., 2018, 1,692,919,135 sources)";

   this.__base__ = GaiaXPSDCatalogBase;
   this.__base__( "GaiaDR2_XPSD", "Gaia DR2 (XPSD)",
                  ((typeof Gaia) != 'undefined') ? Gaia.prototype.DataRelease_2 : 0,
                  2457206.375 /* 2015.5 */ );

   this.GetConstructor = function()
   {
      return "new GaiaDR2XPSDCatalog()";
   };
}

GaiaDR2XPSDCatalog.prototype = new GaiaXPSDCatalogBase;

__catalogRegister__.Register( new GaiaDR2XPSDCatalog );

// ******************************************************************
// Gaia EDR3 Local XPSD Server
// ******************************************************************

function GaiaEDR3XPSDCatalog()
{
   this.description = "Gaia Early Data Release 3 - Local XPSD Server (Gaia collaboration et al., 2020, 1,806,254,432 sources)";

   this.__base__ = GaiaXPSDCatalogBase;
   this.__base__( "GaiaEDR3_XPSD", "Gaia EDR3 (XPSD)",
                  ((typeof Gaia) != 'undefined') ? Gaia.prototype.DataRelease_E3 : 0,
                  2457389.0 /* 2016.0 */ );

   this.GetConstructor = function()
   {
      return "new GaiaEDR3XPSDCatalog()";
   };
}

GaiaEDR3XPSDCatalog.prototype = new GaiaXPSDCatalogBase;

__catalogRegister__.Register( new GaiaEDR3XPSDCatalog );

// ******************************************************************
// Gaia DR3 Local XPSD Server
// ******************************************************************

function GaiaDR3XPSDCatalog()
{
   this.description = "Gaia Data Release 3 - Local XPSD Server (Gaia collaboration et al., 2022, 1,806,254,432 sources)";

   this.__base__ = GaiaXPSDCatalogBase;
   this.__base__( "GaiaDR3_XPSD", "Gaia DR3 (XPSD)",
                  ((typeof Gaia) != 'undefined') ? Gaia.prototype.DataRelease_3 : 0,
                  2457389.0 /* 2016.0 */ );

   this.GetConstructor = function()
   {
      return "new GaiaDR3XPSDCatalog()";
   };
}

GaiaDR3XPSDCatalog.prototype = new GaiaXPSDCatalogBase;

__catalogRegister__.Register( new GaiaDR3XPSDCatalog );

// ******************************************************************
// APASS_Catalog
// ******************************************************************

function APASS_Catalog()
{
   this.description = "AAVSO Photometric All Sky Survey DR9 (Henden+, 2016, 62 million stars)";

   this.__base__ = VizierCatalog;
   this.__base__( "APASS", "APASS" );

   this.catalogMagnitude = 17;
   this.magMin = 10;
   this.magMax = 17;
   this.fields = ["Coordinates", "Vmag", "Bmag", "g'mag", "r'mag", "i'mag", "B-V"];

   this.properties.push( ["magMin", DataType_Double] );
   this.properties.push( ["magMax", DataType_Double] );
   this.properties.push( ["magnitudeFilter", DataType_UCString] );

   this.filters = ["Vmag", "Bmag", "g'mag", "r'mag", "i'mag"];
   this.magnitudeFilter = "Vmag";

   this.GetConstructor = function()
   {
      return "new APASS_Catalog()";
   };

   this.UrlBuilder = function( center, fov, mirrorServer )
   {
      let url = mirrorServer + "viz-bin/asu-tsv?-source=II/336/apass9&-c=" +
         format( "%f %f", center.x, center.y ) +
         "&-c.r=" + format( "%f", fov ) +
         "&-c.u=deg&-out.form=|" +
         "&-out.add=_RAJ,_DEJ&-out=B-V&-out=Vmag&-out=Bmag&-out=g'mag&-out=r'mag&-out=i'mag" +
         this.CreateMagFilter( this.magnitudeFilter, this.magMin, this.magMax );
      return url;
   };

   this.ParseRecord = function( tokens )
   {
      if ( tokens.length >= 2 && parseFloat( tokens[0] ) > 0 )
      {
         let x = parseFloat( tokens[0] );
         let y = parseFloat( tokens[1] );
         if ( !(x >= 0 && x <= 360 && y >= -90 && y <= 90) )
            return null;
         if ( this.position != null )
         {
            let q = this.placeFunction( this.position, new StarPosition( x, y ) );
            x = Math.deg( q[0] );
            y = Math.deg( q[1] );
         }
         let name = tokens[0] + "_" + tokens[1];
         let record = new CatalogRecord( new Point( x, y ), 0, name, 0 );
         if ( tokens.length > 2 )
            record["B-V"] = tokens[2].trim();
         if ( tokens.length > 3 )
            record["Vmag"] = tokens[3].trim();
         if ( tokens.length > 4 )
            record["Bmag"] = tokens[4].trim();
         if ( tokens.length > 5 )
            record["g'mag"] = tokens[5].trim();
         if ( tokens.length > 6 )
            record["r'mag"] = tokens[6].trim();
         if ( tokens.length > 7 )
            record["i'mag"] = tokens[7].trim();
         if ( record[this.magnitudeFilter] )
            record.magnitude = parseFloat( record[this.magnitudeFilter] );
         return record;
      }

      return null;
   };

   this.PostProcessObjects = function( objects )
   {
      // The workflow of APASS DR9 can generate duplicated stars
      // Since the resolution of the cameras is 2.5"/px the tolerance
      // will be 2.5"/px
      this.RemoveDuplicates( objects, 3/3600 );
   };
}

APASS_Catalog.prototype = new VizierCatalog;

__catalogRegister__.Register( new APASS_Catalog );

// ******************************************************************
// Base class for APASS catalogs implemented as local XPSD servers.
// ******************************************************************

function APASSXPSDCatalogBase( id, name, dataRelease )
{
   this.__base__ = CatalogWithMagnitudeFilters;
   this.__base__( id, name );

   this.hasXPSDServer = true;
   this.bounds = null;
   this.catalogMagnitude = 18;
   this.magMin = 7; // See https://www.aavso.org/apass 'Known Problems in DR10'
   this.magMax = 18;
   this.maxRecords = 200000;
   this.maxFov = null;
   this.fields = ["Coordinates", "Vmag", "Bmag", "g'mag", "r'mag", "i'mag", "z_smag", "Flags"];

   this.properties.push( ["magMin", DataType_Double] );
   this.properties.push( ["magMax", DataType_Double] );
   this.properties.push( ["magnitudeFilter", DataType_UCString ] );

   this.filters = ["Vmag", "Bmag", "g'mag", "r'mag", "i'mag", "z_smag"];
   this.magnitudeFilter = "Vmag";

   this.dataRelease = dataRelease;

   this.newXPSDServer = function()
   {
      if ( (typeof APASS) == 'undefined' )
         throw new Error( "The APASS process is not installed." );

      let server = new APASS;
      server.dataRelease = this.dataRelease;
      server.magnitudeLow = (this.magMin == NULLMAG) ? -1.5 : this.magMin;
      server.magnitudeHigh = this.magMax;
      server.sourceLimit = this.maxRecords;
      // Exclude:
      //    - Sources without Johnson V magnitudes.
      server.exclusionFlags = APASSFlag_NoMag_V;
      server.sortBy = APASS.prototype.SortBy_V;
      server.generateTextOutput = false;
      return server;
   };

   this.Load = function( metadata )
   {
      let server = this.newXPSDServer();
      server.command = "search";
      server.centerRA = metadata.ra;
      server.centerDec = metadata.dec;
      server.radius = metadata.SearchRadius();
      server.verbosity = 1; // minimal console information

      if ( !server.executeGlobal() )
         throw new Error( "Failure to execute XPSD server search command." );

      this.position = new Position( metadata.observationTime, "UTC" );
      if ( metadata.topocentric && metadata.obsLongitude != null && metadata.obsLatitude != null )
         this.position.observer = new ObserverPosition( metadata.obsLongitude, metadata.obsLatitude,
                                                        (metadata.obsHeight != null) ? metadata.obsHeight : 0 );
      let F = placeFunctionForReferenceSystem( metadata.referenceSystem );
      this.objects = [];
      for ( let S = server.sources, i = 0; i < S.length; ++i )
      {
         // 0   1    2      3      4      5      6      7
         // ra, dec, mag_V, mag_B, mag_g, mag_r, mag_i, mag_z_s,
         // 8            9            10           11           12           13             14
         // mag_V_error, mag_B_error, mag_g_error, mag_r_error, mag_i_error, mag_z_s_error, flags
         let s = S[i];
         let q = F( this.position, new StarPosition( s[0], s[1] ) );
         let record = new CatalogRecord( new Point( Math.deg( q[0] ), Math.deg( q[1] ) ), 0/*diameter*/, ''/*name*/, s[2]/*mag_V*/ );
         record["Vmag"] = format( "%.3f", s[2] );
         let flags = s[14];
         if ( !(flags & APASSFlag_NoMag_B) )
            record["Bmag"] = format( "%.3f", s[3] );
         if ( !(flags & APASSFlag_NoMag_g) )
            record["g'mag"] = format( "%.3f", s[4] );
         if ( !(flags & APASSFlag_NoMag_r) )
            record["r'mag"] = format( "%.3f", s[5] );
         if ( !(flags & APASSFlag_NoMag_i) )
            record["i'mag"] = format( "%.3f", s[6] );
         if ( !(flags & APASSFlag_NoMag_z_s) )
            record["z_smag"] = format( "%.3f", s[7] );
         record["Flags"] = format( "%08x", flags );
         if ( record[this.magnitudeFilter] )
            record.magnitude = parseFloat( record[this.magnitudeFilter] );
         this.objects.push( record );
      }

      if ( metadata.ref_I_G )
      {
         let insideObjects = 0;
         for ( let i = 0; i < this.objects.length; ++i )
            if ( this.objects[i] )
            {
               let posI = metadata.Convert_RD_I( this.objects[i].posRD, true/*unscaled*/ );
               if ( posI
                 && posI.x > 0
                 && posI.y > 0
                 && posI.x < metadata.width
                 && posI.y < metadata.height )
               {
                  ++insideObjects;
               }
            }
         console.writeln( "<b>Catalog ", this.name, "</b>: ", insideObjects, " objects inside the image." );
      }
      else
         console.writeln( "<b>Catalog ", this.name, "</b>: ", this.objects.length, " objects." );
   };

   this.GetEditControls = function( parent )
   {
      return this.GetMagnitudeFilterControls( parent );
   };
}

// ******************************************************************
// APASS DR9 Local XPSD Server
// ******************************************************************

function APASSDR9XPSDCatalog()
{
   this.description = "APASS Data Release 9 - Local XPSD Server (Henden+, 2016, 62 million stars)";

   this.__base__ = APASSXPSDCatalogBase;
   this.__base__( "APASSDR9_XPSD", "APASS DR9 (XPSD)",
                  ((typeof APASS) != 'undefined') ? APASS.prototype.DataRelease_9 : 0 );

   this.GetConstructor = function()
   {
      return "new APASSDR9XPSDCatalog()";
   };
}

APASSDR9XPSDCatalog.prototype = new Catalog;

__catalogRegister__.Register( new APASSDR9XPSDCatalog );

// ******************************************************************
// APASS DR10 Local XPSD Server
// ******************************************************************

function APASSDR10XPSDCatalog()
{
   this.description = "APASS Data Release 10 - Local XPSD Server (Henden+, 2018, 128 million stars)";

   this.__base__ = APASSXPSDCatalogBase;
   this.__base__( "APASSDR10_XPSD", "APASS DR10 (XPSD)",
                  ((typeof APASS) != 'undefined') ? APASS.prototype.DataRelease_10 : 0 );

   this.GetConstructor = function()
   {
      return "new APASSDR10XPSDCatalog()";
   };
}

APASSDR10XPSDCatalog.prototype = new Catalog;

__catalogRegister__.Register( new APASSDR10XPSDCatalog );

// ******************************************************************
// CustomCatalog: Uses a file to store the info
// ******************************************************************

function CustomCatalog()
{
   this.description = "User defined catalog";

   this.__base__ = Catalog;
   this.__base__( "Custom", "Custom Catalog" );

   this.catalogPath = null;

   this.fields = ["Name", "Coordinates", "Magnitude"];
   this.properties.push( ["catalogPath", DataType_UCString] );

   this.GetConstructor = function()
   {
      return "new CustomCatalog()";
   };

   this.Validate = function()
   {
      if ( !this.catalogPath || this.catalogPath.trim().length == 0 )
      {
         (new MessageBox( "The path of the custom catalog is empty", TITLE, StdIcon_Error, StdButton_Ok )).execute();
         return false;
      }
      if ( !File.exists( this.catalogPath ) )
      {
         (new MessageBox( "The file of the custom catalog doesn't exist", TITLE, StdIcon_Error, StdButton_Ok )).execute();
         return false;
      }

      let catalogLines = this.LoadLines();

      if ( catalogLines.length == 0 )
      {
         new MessageBox( "The custom catalog is empty", TITLE, StdIcon_Error ).execute();
         return false;
      }

      return this.ParseHeader( catalogLines[0] ) != null;
   };

   this.LoadLines = function()
   {
      let file = File.openFileForReading( this.catalogPath );
      if ( !file.isOpen )
      {
         new MessageBox( "The custom catalog file could not be opened", TITLE, StdIcon_Error, StdButton_Ok ).execute();
         return [];
      }

      let fileData = file.read( DataType_ByteArray,file.size );
      file.close();
      let str = fileData.toString();
      if ( str.indexOf( "\r\n" ) >= 0 )
         return str.split( "\r\n" );
      else if ( str.indexOf( "\r" ) >= 0 )
         return str.split( "\r" );
      else
         return str.split( "\n" );
   };

   this.ParseHeader = function( headerLine )
   {
      if ( !headerLine )
      {
         new MessageBox( "The header line is empty", TITLE, StdIcon_Error ).execute();
         return null;
      }
      let index = {};

      let fields = headerLine.split( '\t' );
      fields = fields.map( function(s) { return s.trim().toLowerCase(); } );
      index.ra  = fields.indexOf( "ra" );
      index.dec = fields.indexOf( "dec" );
      index.dia = fields.indexOf( "diameter" );
      index.mag = fields.indexOf( "magnitude" );
      index.nam = fields.indexOf( "name" );

      if ( index.ra < 0 || index.dec < 0 )
      {
         new MessageBox( "The custom catalog does not define the required coordinate columns", TITLE, StdIcon_Error ).execute();
         return null;
      }

      return index;
   };

   this.Load = function( metadata )
   {
      if ( !this.catalogPath )
         return false;

      let catalogLines = this.LoadLines();
      if ( catalogLines.length == 0 )
      {
         new MessageBox( "The custom catalog is empty", TITLE, StdIcon_Error ).execute();
         return false;
      }

      let index = this.ParseHeader( catalogLines[0] );
      if ( index == null )
         return false;

      let minLength = Math.max( index.ra, index.dec ) + 1;

      this.position = new Position( metadata.observationTime, "UTC" );
      if ( metadata.topocentric && metadata.obsLongitude != null && metadata.obsLatitude != null )
         this.position.observer = new ObserverPosition( metadata.obsLongitude, metadata.obsLatitude,
                                                        (metadata.obsHeight != null) ? metadata.obsHeight : 0 );
      let F = placeFunctionForReferenceSystem( metadata.referenceSystem );
      this.objects = [];
      let numWarnings = 0;
      for ( let i = 1; i < catalogLines.length; i++ )
      {
         if ( catalogLines[i].trim().length == 0 )
            continue;
         let fields = catalogLines[i].split( '\t' );

         if ( fields.length < minLength )
         {
            if ( numWarnings < 50 )
               console.warningln( "<end><cbr>** Warning: The line ", i+1, " does not contain coordinates." );
            numWarnings++;
            continue;
         }

         let q = F( this.position, new StarPosition( parseFloat( fields[index.ra] ), parseFloat( fields[index.dec] ) ) );

         let diameter = 0;
         if ( index.dia >= 0 && fields.length > index.dia )
            diameter = parseFloat( fields[index.dia] )/60;

         let name;
         if ( index.nam >= 0 && fields.length > index.nam )
            name = fields[index.nam].trim();

         let magnitude;
         if ( index.mag >= 0 && fields.length > index.mag  )
            magnitude = parseFloat( fields[index.mag] );

         this.objects.push( new CatalogRecord( new Point( Math.deg( q[0] ), Math.deg( q[1] ) ), diameter, name, magnitude ) );
      }
      if ( numWarnings > 50 )
         console.warningln( "<end><cbr>** Total number of warnings: ", numWarnings );
      console.writeln( "<end><cbr><br><b>Custom catalog</b>: ", this.objects.length, " objects" );

      return true;
   };

   this.GetEditControls = function( parent )
   {
      // Catalog path
      let path_Label = new Label( parent );
      path_Label.text = "Catalog path:";
      path_Label.textAlignment = TextAlign_Right|TextAlign_VertCenter;

      let path_Edit = new Edit( parent );
      path_Edit.text = this.catalogPath ? this.catalogPath : "";
      path_Edit.onTextUpdated = function( value ) { this.dialog.activeFrame.object.catalog.catalogPath = value; };

      let path_Button = new ToolButton( parent );
      path_Button.icon = parent.scaledResource( ":/icons/select-file.png" );
      path_Button.setScaledFixedSize( 20, 20 );
      path_Button.toolTip = "<p>Select the custom catalog file.</p>";
      path_Button.onClick = function()
      {
         let gdd = new OpenFileDialog;
         if ( this.dialog.activeFrame.object.catalog.catalogPath )
            gdd.initialPath = this.dialog.activeFrame.object.catalog.catalogPath;
         gdd.caption = "Select Custom Catalog Path";
         gdd.filters = [["Text files", "*.txt"]];
         if ( gdd.execute() )
         {
            this.dialog.activeFrame.object.catalog.catalogPath = gdd.fileName;
            path_Edit.text = gdd.fileName;
         }
      };

      let download_Button = new ToolButton( parent );
      download_Button.icon = parent.scaledResource( ":/icons/download.png" );
      download_Button.setScaledFixedSize( 20, 20 );
      download_Button.toolTip = "<p>Download from an online catalog.</p>";
      download_Button.onClick = function()
      {
         let metadata = null;
         let server = parent.engine.vizierServer;
         if (parent.engine)
         {
            if (parent.engine.metadata)
               metadata = parent.engine.metadata;
            if (parent.engine.vizierServer)
               server = parent.engine.vizierServer;
         }
         let dlg = new CatalogDownloaderDialog(metadata, server);
         if ( dlg.execute() )
         {
            this.dialog.activeFrame.object.catalog.catalogPath = dlg.path;
            path_Edit.text = dlg.path;
         }
      };

      let pathSizer = new HorizontalSizer;
      pathSizer.scaledSpacing = 4;
      pathSizer.add( path_Label );
      pathSizer.add( path_Edit, 100 );
      pathSizer.add( path_Button );
      pathSizer.add( download_Button );

      return [pathSizer];
   };
}

CustomCatalog.prototype = new Catalog;

__catalogRegister__.Register( new CustomCatalog );

// ******************************************************************
// VizierMirrorDialog: Selects a mirror of the VizieR service.
// ******************************************************************

function VizierMirrorDialog( serverAddress )
{
   this.__base__ = Dialog;
   this.__base__();

   this.helpLabel = new Label( this );
   this.helpLabel.text = "Select a Vizier catalog server:"

   this.server_List = new TreeBox( this );
   this.server_List.alternateRowColor = false;
   this.server_List.multipleSelection = false;
   this.server_List.headerVisible = false;
   this.server_List.numberOfColumns = 1;
   this.server_List.setHeaderText( 0, "Description" );
   //this.server_List.setHeaderText( 1, "Address" );
   this.server_List.rootDecoration = false;

   for ( let m = 0; m < VizierCatalog.mirrors.length; ++m )
   {
      let node = new TreeBoxNode( this.server_List );
      node.checkable = false;
      node.setText( 0, VizierCatalog.mirrors[m].name );
      node.address = VizierCatalog.mirrors[m].address;
      if ( VizierCatalog.mirrors[m].address == serverAddress )
         node.selected = true;
   }
   this.server_List.adjustColumnWidthToContents( 0 );
   this.server_List.setMinWidth( this.server_List.columnWidth( 0 ) * 1.1 );

   this.resetCache_Button = new PushButton( this );
   this.resetCache_Button.text = "Reset Catalog Cache";
   this.resetCache_Button.icon = this.scaledResource( ":/icons/delete.png" );
   this.resetCache_Button.toolTip = "<p>Resets the VizieR catalog cache.</p>" +
      "<p>The script uses a special cache to store VizieR catalog query results. " +
      "This saves considerable time by avoiding unnecessary network transfers. " +
      "However, sometimes a query fails because of a temporary problem, but " +
      "still returns a result that the script cannot recognize as invalid. " +
      "In these cases this action resets the internal cache, so that new queries " +
      "can be sent to the VizieR server to retrieve valid data.</p>";
   this.resetCache_Button.onClick = function()
   {
      __vizier_cache__ = new VizierCache();
      if ( !Parameters.getBoolean( "non_interactive" ) )
         (new MessageBox( "<p>The VizieR catalog cache has been cleared.</p>",
                          TITLE, StdIcon_Information, StdButton_Ok )).execute();
   };

   // TERMS OF USE of VizieR catalogs
   this.terms_Button = new ToolButton( this );
   this.terms_Button.text = "Terms of use of VizieR data";
   this.terms_Font = new Font( this.font.family, this.font.pointSize );
   this.terms_Font.underline = true;
   this.terms_Button.font = this.terms_Font;
   this.terms_Button.onClick = function()
   {
      Dialog.openBrowser( "https://cds.unistra.fr/vizier-org/licences_vizier.html" );
   };

   this.buttons1_Sizer = new HorizontalSizer;
   this.buttons1_Sizer.scaledSpacing = 6;
   this.buttons1_Sizer.add( this.resetCache_Button );
   this.buttons1_Sizer.addStretch();
   this.buttons1_Sizer.add( this.terms_Button );

   // Buttons

   this.ok_Button = new PushButton( this );
   this.ok_Button.defaultButton = true;
   this.ok_Button.text = "OK";
   this.ok_Button.icon = this.scaledResource( ":/icons/ok.png" );
   this.ok_Button.onClick = function ()
   {
      if ( this.dialog.server_List.selectedNodes == 0 )
      {
         if ( !Parameters.getBoolean( "non_interactive" ) )
            (new MessageBox( "No server has been selected.",
                             TITLE, StdIcon_Error, StdButton_Ok )).execute();
         return;
      }
      this.dialog.server = this.dialog.server_List.selectedNodes[0].address;
      this.dialog.ok();
   };

   this.cancel_Button = new PushButton( this );
   this.cancel_Button.text = "Cancel";
   this.cancel_Button.icon = this.scaledResource( ":/icons/cancel.png" );
   this.cancel_Button.onClick = function()
   {
      this.dialog.cancel();
   };

   this.buttons_Sizer = new HorizontalSizer;
   this.buttons_Sizer.scaledSpacing = 6;
   this.buttons_Sizer.addStretch();
   this.buttons_Sizer.add( this.ok_Button );
   this.buttons_Sizer.add( this.cancel_Button );

   // Global sizer
   this.sizer = new VerticalSizer;
   this.sizer.scaledMargin = 8;
   this.sizer.scaledSpacing = 6;
   this.sizer.add( this.helpLabel );
   this.sizer.add( this.server_List );
   this.sizer.add( this.buttons1_Sizer );
   this.sizer.addScaledSpacing( 6 );
   this.sizer.add( this.buttons_Sizer );

   this.windowTitle = "Vizier Servers";
   this.adjustToContents();
}

VizierMirrorDialog.prototype = new Dialog;
