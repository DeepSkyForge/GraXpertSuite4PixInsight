/*
 * Common User Interface Controls
 *
 * Copyright (C) 2015-2020, Andres del Pozo
 * Contributions (C) 2019-2020, Juan Conejero (PTeam)
 * Contributions(C) 2022 - 2022, Roberto Sartori (PTeam)
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

/* beautify ignore:start */
#ifndef __ADP_COMMONUICONTROLS_js
#define __ADP_COMMONUICONTROLS_js
/* beautify ignore:end */

// ----------------------------------------------------------------------------

function fieldLabel( parent, text, width )
{
   this.label = new Label( parent );
   this.label.text = text;
   this.label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
   if ( width != undefined && width != null )
      this.label.setFixedWidth( width );
   return this.label;
}

// ----------------------------------------------------------------------------

function coordSpinBox( parent, value, maxVal, width, tooltip, onValueUpdated )
{
   this.spinBox = new SpinBox( parent );
   this.spinBox.minValue = 0;
   this.spinBox.maxValue = maxVal;
   if ( value )
      this.spinBox.value = value;
   this.spinBox.toolTip = tooltip;
   this.spinBox.setFixedWidth( width );
   this.spinBox.onValueUpdated = onValueUpdated;
   return this.spinBox;
}

// ----------------------------------------------------------------------------

/*
 * CoordinatesEditor: Editor of RA/Dec coordinates
 */
function CoordinatesEditor( parent, coords, // Point in deg/deg
   labelWidth, spinBoxWidth, tooltip )
{
   this.__base__ = Control;
   this.__base__( parent );

   let spinBoxWidth1, spinBoxWidth2;
   if ( spinBoxWidth == null )
   {
      spinBoxWidth1 = parent.font.width( "888888" );
      spinBoxWidth2 = parent.font.width( "88888888" );
   }
   else
      spinBoxWidth1 = spinBoxWidth2 = spinBoxWidth;

   let unitLabelWidth = Math.round( parent.font.width( "M" ) + 0.1 * parent.font.width( "m" ) );

   this.ra = ( coords != null && coords.x != null ) ? DMSangle.FromAngle( coords.x / 15 ) : new DMSangle;
   this.dec = ( coords != null && coords.y != null ) ? DMSangle.FromAngle( coords.y ) : new DMSangle;

   this.onChange = function()
   {
      if ( this.onChangeCallback )
         this.onChangeCallback.call( this.onChangeCallbackScope, this.GetCoords() );
   };

   // RA

   this.ra_Label = new fieldLabel( this, "Right Ascension:", labelWidth );

   this.ra_h_SpinBox = new coordSpinBox( this, this.ra.deg, 23, spinBoxWidth1, tooltip,
      function( value )
      {
         this.parent.ra.deg = value;
         this.parent.onChange();
      } );

   this.ra_h_Label = new Label( this );
   this.ra_h_Label.text = "h";
   this.ra_h_Label.setFixedWidth( unitLabelWidth );

   this.ra_min_SpinBox = new coordSpinBox( this, this.ra.min, 59, spinBoxWidth1, tooltip,
      function( value )
      {
         this.parent.ra.min = value;
         this.parent.onChange();
      } );

   this.ra_min_Label = new Label( this );
   this.ra_min_Label.text = "m";
   this.ra_min_Label.setFixedWidth( unitLabelWidth );

   this.ra_sec_Edit = new Edit( this );
   this.ra_sec_Edit.text = format( "%.3f", this.ra.sec );
   this.ra_sec_Edit.toolTip = tooltip;
   this.ra_sec_Edit.setFixedWidth( spinBoxWidth2 );
   this.ra_sec_Edit.onTextUpdated = function( value )
   {
      this.parent.ra.sec = parseFloat( value );
      this.parent.onChange();
   };

   this.ra_sec_Label = new Label( this );
   this.ra_sec_Label.text = "s";
   this.ra_sec_Label.setFixedWidth( unitLabelWidth );

   this.ra_Sizer = new HorizontalSizer;
   this.ra_Sizer.spacing = 4;
   this.ra_Sizer.add( this.ra_Label );
   this.ra_Sizer.add( this.ra_h_SpinBox );
   this.ra_Sizer.add( this.ra_h_Label );
   this.ra_Sizer.add( this.ra_min_SpinBox );
   this.ra_Sizer.add( this.ra_min_Label );
   this.ra_Sizer.add( this.ra_sec_Edit );
   this.ra_Sizer.add( this.ra_sec_Label );
   this.ra_Sizer.addStretch();

   // DEC

   this.dec_Label = new fieldLabel( this, "Declination:", labelWidth );

   this.dec_d_SpinBox = new coordSpinBox( this, this.dec.deg, 90, spinBoxWidth1, tooltip,
      function( value )
      {
         this.parent.dec.deg = value;
         this.parent.onChange();
      } );

   this.dec_d_Label = new Label( this );
   this.dec_d_Label.text = "\u00B0";
   this.dec_d_Label.setFixedWidth( unitLabelWidth );

   this.dec_min_SpinBox = new coordSpinBox( this, this.dec.min, 59, spinBoxWidth1, tooltip,
      function( value )
      {
         this.parent.dec.min = value;
         this.parent.onChange();
      } );

   this.dec_min_Label = new Label( this );
   this.dec_min_Label.text = "'";
   this.dec_min_Label.setFixedWidth( unitLabelWidth );

   this.dec_sec_Edit = new Edit( this );
   this.dec_sec_Edit.text = format( "%.2f", this.dec.sec );
   this.dec_sec_Edit.toolTip = tooltip;
   this.dec_sec_Edit.setFixedWidth( spinBoxWidth2 );
   this.dec_sec_Edit.onTextUpdated = function( value )
   {
      this.parent.dec.sec = parseFloat( value );
      this.parent.onChange();
   };

   this.dec_sec_Label = new Label( this );
   this.dec_sec_Label.text = "\"";
   this.dec_sec_Label.setFixedWidth( unitLabelWidth );

   this.isSouth_CheckBox = new CheckBox( this );
   this.isSouth_CheckBox.text = "S";
   this.isSouth_CheckBox.checked = this.dec.sign < 0;
   this.isSouth_CheckBox.toolTip = "<p>When checked, the declination is negative (Southern hemisphere).</p>";
   this.isSouth_CheckBox.onCheck = function( checked )
   {
      this.parent.dec.sign = checked ? -1 : 1;
      this.parent.onChange();
   };

   this.dec_Sizer = new HorizontalSizer;
   this.dec_Sizer.spacing = 4;
   this.dec_Sizer.add( this.dec_Label );
   this.dec_Sizer.add( this.dec_d_SpinBox );
   this.dec_Sizer.add( this.dec_d_Label );
   this.dec_Sizer.add( this.dec_min_SpinBox );
   this.dec_Sizer.add( this.dec_min_Label );
   this.dec_Sizer.add( this.dec_sec_Edit );
   this.dec_Sizer.add( this.dec_sec_Label );
   this.dec_Sizer.add( this.isSouth_CheckBox );
   this.dec_Sizer.addStretch();

   this.sizer = new VerticalSizer;
   this.sizer.margin = 0;
   this.sizer.spacing = 4;
   this.sizer.add( this.ra_Sizer );
   this.sizer.add( this.dec_Sizer );
}

CoordinatesEditor.prototype = new Control();

CoordinatesEditor.prototype.SetCoords = function( coords )
{
   this.ra = ( coords != null && coords.x != null ) ? DMSangle.FromAngle( coords.x / 15 ) : new DMSangle;
   this.ra_h_SpinBox.value = this.ra.deg;
   this.ra_min_SpinBox.value = this.ra.min;
   this.ra_sec_Edit.text = format( "%.3f", this.ra.sec );

   this.dec = ( coords != null && coords.y != null ) ? DMSangle.FromAngle( coords.y ) : new DMSangle;
   this.dec_d_SpinBox.value = this.dec.deg;
   this.dec_min_SpinBox.value = this.dec.min;
   this.dec_sec_Edit.text = format( "%.2f", this.dec.sec );
   this.isSouth_CheckBox.checked = this.dec.sign < 0;
};

CoordinatesEditor.prototype.GetCoords = function( validate )
{
   let raVal = this.ra.GetValue();
   if ( ( validate == null || validate ) && ( raVal < 0 || raVal > 24 ) )
   {
      new MessageBox( "Invalid right ascension", TITLE, StdIcon_Error ).execute();
      return null;
   }

   let decVal = this.dec.GetValue();
   if ( ( validate == null || validate ) && ( decVal < -90 || decVal > +90 ) )
   {
      new MessageBox( "Invalid declination", TITLE, StdIcon_Error ).execute();
      return null;
   }

   return new Point( raVal * 15, decVal );
};

CoordinatesEditor.prototype.setLabels = function( raText, decText )
{
   this.ra_Label.text = raText;
   this.dec_Label.text = decText;
};

CoordinatesEditor.prototype.setOnChange = function( callback, scope )
{
   this.onChangeCallback = callback;
   this.onChangeCallbackScope = scope;
};

// ----------------------------------------------------------------------------

/*
 * TransparentColorControl: Configuration control for colors
 */
function TransparentColorControl( parent, initialValue, toolTip )
{
   this.__base__ = Control;
   if ( parent )
      this.__base__( parent );
   else
      this.__base__();

   this.color = initialValue;
   this.onColorChanged = null;

   this.color_ComboBox = new ColorComboBox( parent );
   this.color_ComboBox.setCurrentColor( this.color );
   this.color_ComboBox.toolTip = toolTip;
   this.color_ComboBox.onColorSelected = function( rgba )
   {
      this.parent.color = Color.setAlpha( rgba, Color.alpha( this.parent.color ) );
      if ( this.parent.onColorChanged )
         this.parent.onColorChanged( this.parent.color );
   };

   this.transparency_SpinBox = new SpinBox( parent );
   this.transparency_SpinBox.minValue = 0;
   this.transparency_SpinBox.maxValue = 255;
   this.transparency_SpinBox.setFixedWidth( parent.font.width( "8888888" ) )
   this.transparency_SpinBox.value = Color.alpha( this.color );
   this.transparency_SpinBox.toolTip = toolTip + ": Alpha value (0=transparent, 255=opaque)";
   this.transparency_SpinBox.onValueUpdated = function( value )
   {
      this.parent.color = Color.setAlpha( this.parent.color, value );
      if ( this.parent.onColorChanged )
         this.parent.onColorChanged( this.parent.color );
   };

   this.color_Button = new ToolButton( parent );
   this.color_Button.icon = this.scaledResource( ":/icons/select-color.png" );
   this.color_Button.setScaledFixedSize( 20, 20 );
   this.color_Button.toolTip = toolTip + ": Define a custom color.";
   this.color_Button.onClick = function()
   {
      //console.writeln( format("%x",this.parent.color),  this.parent.color_ComboBox);
      let scd = new SimpleColorDialog( this.parent.color );
      scd.windowTitle = toolTip + ": Custom RGBA Color";
      if ( scd.execute() )
      {
         this.parent.color = scd.color;
         this.parent.color_ComboBox.setCurrentColor( scd.color );
         this.parent.transparency_SpinBox.value = Color.alpha( scd.color );
         if ( this.parent.onColorChanged )
            this.parent.onColorChanged( this.parent.color );
      }
   };

   this.sizer = new HorizontalSizer;
   this.sizer.scaledSpacing = 4;
   this.sizer.add( this.color_ComboBox );
   this.sizer.add( this.transparency_SpinBox );
   this.sizer.add( this.color_Button );
}

TransparentColorControl.prototype = new Control;

// ----------------------------------------------------------------------------

/*
 * FontControl
 */
function FontControl( parent, callbackScope, fontDef )
{
   this.__base__ = Control;
   if ( parent )
      this.__base__( parent );
   else
      this.__base__();

   this.fontDef = fontDef;
   this.onChanged = null;
   this.callbackScope = callbackScope;

   this.raiseOnChanged = function()
   {
      if ( this.onChanged )
         if ( this.callbackScope )
            this.onChanged.call( this.callbackScope, this.fontDef );
         else
            this.onChanged( this.fontDef );
   };

   // Face
   this.labelFace_Combo = new ComboBox( parent );
   this.labelFace_Combo.editEnabled = false;
   this.labelFace_Combo.addItem( "DejaVu Sans" );
   this.labelFace_Combo.addItem( "DejaVu Sans Mono" );
   this.labelFace_Combo.addItem( "DejaVu Serif" );
   this.labelFace_Combo.addItem( "Hack" );
   this.labelFace_Combo.addItem( "Liberation Sans" );
   this.labelFace_Combo.addItem( "Liberation Serif" );
   this.labelFace_Combo.addItem( "M+ 1c" );
   this.labelFace_Combo.addItem( "M+ 1m" );
   this.labelFace_Combo.addItem( "M+ 1p" );
   this.labelFace_Combo.addItem( "Open Sans" );
   this.labelFace_Combo.currentItem = Math.range( this.labelFace_Combo.findItem( this.fontDef.face ),
      0, this.labelFace_Combo.numberOfItems - 1 );
   this.labelFace_Combo.onItemSelected = function( itemIndex )
   {
      this.parent.fontDef.face = this.itemText( itemIndex ).trim();
      this.parent.raiseOnChanged();
   };

   this.labelSize_SpinBox = new SpinBox( parent );
   this.labelSize_SpinBox.minValue = 4;
   this.labelSize_SpinBox.maxValue = 120;
   this.labelSize_SpinBox.setFixedWidth( parent.font.width( "888888" ) );
   this.labelSize_SpinBox.value = this.fontDef.size;
   this.labelSize_SpinBox.toolTip = "<p>Font size in points.</p>";
   this.labelSize_SpinBox.onValueUpdated = function( value )
   {
      this.parent.fontDef.size = value;
      this.parent.raiseOnChanged();
   };

   this.labelBold_Check = new CheckBox( parent );
   this.labelBold_Check.checked = this.fontDef.bold;
   this.labelBold_Check.text = "Bold";
   this.labelBold_Check.toolTip = "<p>Bold font.</p>";
   this.labelBold_Check.onCheck = function( checked )
   {
      this.parent.fontDef.bold = checked;
      this.parent.raiseOnChanged();
   };

   this.labelItalic_Check = new CheckBox( parent );
   this.labelItalic_Check.checked = this.fontDef.italic;
   this.labelItalic_Check.text = "Italic";
   this.labelItalic_Check.toolTip = "<p>Italic font.</p>";
   this.labelItalic_Check.onCheck = function( checked )
   {
      this.parent.fontDef.italic = checked;
      this.parent.raiseOnChanged();
   };

   this.sizer = new HorizontalSizer;
   this.sizer.spacing = 4;
   this.sizer.add( this.labelFace_Combo );
   this.sizer.add( this.labelSize_SpinBox );
   this.sizer.add( this.labelBold_Check );
   this.sizer.add( this.labelItalic_Check );
}

FontControl.prototype = new Control;

// ----------------------------------------------------------------------------

/*
 * DateTimeEditor
 */
function DateTimeEditor( parent, epochJD, labelWidth, spinBoxWidth, withTimeControls, timeBoxWidth )
{
   this.__base__ = Control;
   this.__base__( parent );

   let epochTooltip = "<p>Observation time. This value is used to compute " +
      "proper motions of stars and solar system ephemerides, when applicable.</p>";

   let unitLabelWidth = Math.round( parent.font.width( "M" ) + 0.1 * parent.font.width( "m" ) );

   this.epoch_Label = new fieldLabel( this, withTimeControls ? "Date and time:" : "Observation date:", labelWidth );

   this.onChange = function()
   {
      if ( this.onChangeCallback )
         this.onChangeCallback.call( this.onChangeCallbackScope, this.getEpoch() );
   };

   this.year_SpinBox = new SpinBox( this );
   this.year_SpinBox.minValue = -5000;
   this.year_SpinBox.maxValue = +5000;
   this.year_SpinBox.toolTip = epochTooltip + "<p>The full year of the date (four digits).</p>";
   if ( spinBoxWidth )
      this.year_SpinBox.setFixedWidth( spinBoxWidth );
   this.year_SpinBox.onValueUpdated = function( value )
   {
      this.parent.epoch.setFullYear( value );
      this.parent.onChange();
   };

   this.year_Label = new Label( this );
   this.year_Label.text = "Y";
   this.year_Label.setFixedWidth( unitLabelWidth );

   this.month_SpinBox = new SpinBox( this );
   this.month_SpinBox.minValue = 1;
   this.month_SpinBox.maxValue = 12;
   this.month_SpinBox.toolTip = epochTooltip + "<p>The month of the date in the [1,12] range.</p>";
   if ( spinBoxWidth )
      this.month_SpinBox.setFixedWidth( spinBoxWidth );
   this.month_SpinBox.onValueUpdated = function( value )
   {
      this.parent.epoch.setMonth( value - 1 );
      this.parent.onChange();
   };

   this.month_Label = new Label( this );
   this.month_Label.text = "M";
   this.month_Label.setFixedWidth( unitLabelWidth );

   this.day_SpinBox = new SpinBox( this );
   this.day_SpinBox.minValue = 1;
   this.day_SpinBox.maxValue = 31;
   this.day_SpinBox.toolTip = epochTooltip + "<p>The day of the date in the [1,31] range.</p>";
   if ( spinBoxWidth )
      this.day_SpinBox.setFixedWidth( spinBoxWidth );
   this.day_SpinBox.onValueUpdated = function( value )
   {
      this.parent.epoch.setDate( value );
      this.parent.onChange();
   };

   this.day_Label = new Label( this );
   this.day_Label.text = "d";
   this.day_Label.setFixedWidth( unitLabelWidth );

   if ( withTimeControls )
   {
      this.hour_SpinBox = new SpinBox( this );
      this.hour_SpinBox.minValue = 0;
      this.hour_SpinBox.maxValue = 23;
      this.hour_SpinBox.toolTip = epochTooltip + "<p>The hour in the [0,23] range.</p>";
      if ( timeBoxWidth )
         this.hour_SpinBox.setFixedWidth( timeBoxWidth );
      this.hour_SpinBox.onValueUpdated = function( value )
      {
         this.parent.epoch.setHours( value );
         this.parent.onChange();
      };

      this.hour_Label = new Label( this );
      this.hour_Label.text = "h";
      this.hour_Label.setFixedWidth( unitLabelWidth );

      this.minute_SpinBox = new SpinBox( this );
      this.minute_SpinBox.minValue = 0;
      this.minute_SpinBox.maxValue = 59;
      this.minute_SpinBox.toolTip = epochTooltip + "<p>The minute in the [0,59] range.</p>";
      if ( timeBoxWidth )
         this.minute_SpinBox.setFixedWidth( timeBoxWidth );
      this.minute_SpinBox.onValueUpdated = function( value )
      {
         this.parent.epoch.setMinutes( value );
         this.parent.onChange();
      };

      this.minute_Label = new Label( this );
      this.minute_Label.text = "m";
      this.minute_Label.setFixedWidth( unitLabelWidth );

      this.second_SpinBox = new SpinBox( this );
      this.second_SpinBox.minValue = 0;
      this.second_SpinBox.maxValue = 59;
      this.second_SpinBox.toolTip = epochTooltip + "<p>The second in the [0,59] range.</p>";
      if ( timeBoxWidth )
         this.second_SpinBox.setFixedWidth( timeBoxWidth );
      this.second_SpinBox.onValueUpdated = function( value )
      {
         this.parent.epoch.setSeconds( value );
         this.parent.onChange();
      };

      this.second_Label = new Label( this );
      this.second_Label.text = "s";
      this.second_Label.setFixedWidth( unitLabelWidth );
   }

   this.sizer = new HorizontalSizer();
   this.sizer.spacing = 4;
   this.sizer.add( this.epoch_Label );
   this.sizer.add( this.year_SpinBox );
   this.sizer.add( this.year_Label );
   this.sizer.add( this.month_SpinBox );
   this.sizer.add( this.month_Label );
   this.sizer.add( this.day_SpinBox );
   this.sizer.add( this.day_Label );
   if ( withTimeControls )
   {
      this.sizer.add( this.hour_SpinBox );
      this.sizer.add( this.hour_Label );
      this.sizer.add( this.minute_SpinBox );
      this.sizer.add( this.minute_Label );
      this.sizer.add( this.second_SpinBox );
      this.sizer.add( this.second_Label );
   }
   this.sizer.addStretch();

   this.setEpoch( epochJD );
}

DateTimeEditor.prototype = new Control();

DateTimeEditor.prototype.getEpoch = function()
{
   return Math.calendarTimeToJD(
      this.epoch.getFullYear(), this.epoch.getMonth() + 1, this.epoch.getDate(),
      ( this.epoch.getHours() + ( this.epoch.getMinutes() + this.epoch.getSeconds() / 60 ) / 60 ) / 24 );
};

DateTimeEditor.prototype.setEpoch = function( epochJD )
{
   if ( !epochJD )
      epochJD = 2451545.0;
   let A = Math.jdToCalendarTime( epochJD );
   let hh = A[ 3 ] * 24;
   let mm = Math.frac( hh ) * 60;
   let ss = Math.round( Math.frac( mm ) * 60 );
   mm = Math.trunc( mm );
   hh = Math.trunc( hh );
   if ( ss == 60 )
   {
      ss = 0;
      mm += 1;
   }
   if ( mm == 60 )
   {
      mm = 0;
      hh += 1;
   }
   if ( hh == 24 )
   {
      this.setEpoch( Math.calendarTimeToJD( A[ 0 ], A[ 1 ], A[ 2 ] + 1, ( mm + ss / 60 ) / 1440 ) );
      return;
   }
   this.epoch = new Date( A[ 0 ], A[ 1 ] - 1, A[ 2 ], hh, mm, ss, 0 /*msec*/ );
   this.year_SpinBox.value = this.epoch.getFullYear();
   this.month_SpinBox.value = this.epoch.getMonth() + 1;
   this.day_SpinBox.value = this.epoch.getDate();
   if ( this.hour_SpinBox )
   {
      this.hour_SpinBox.value = this.epoch.getHours();
      this.minute_SpinBox.value = this.epoch.getMinutes();
      this.second_SpinBox.value = this.epoch.getSeconds();
   }
};

DateTimeEditor.prototype.setOnChange = function( callback, scope )
{
   this.onChangeCallback = callback;
   this.onChangeCallbackScope = scope;
};

// ----------------------------------------------------------------------------

function GeodeticCoordinatesEditor( parent, longitude, latitude, altitude, labelWidth, editWidth )
{
   this.__base__ = Control;
   this.__base__( parent );

   let unitLabelWidth = Math.round( parent.font.width( "M" ) + 0.1 * parent.font.width( "m" ) );

   this.longitude_Label = new Label( this );
   this.longitude_Label.text = "Longitude:";
   this.longitude_Label.toolTip = "<p>Observer position, geodetic longitude " +
      "(degrees, minutes and seconds or arc).</p>";
   this.longitude_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
   this.longitude_Label.setFixedWidth( labelWidth );

   this.longitude_D_SpinBox = new SpinBox( this );
   this.longitude_D_SpinBox.setRange( 0, 179 );
   this.longitude_D_SpinBox.setFixedWidth( editWidth );
   this.longitude_D_SpinBox.toolTip = "<p>Geodetic longitude of the observer, degrees.</p>";

   this.longitude_D_Label = new Label( this );
   this.longitude_D_Label.text = "\u00B0";
   this.longitude_D_Label.setFixedWidth( unitLabelWidth );

   this.longitude_M_SpinBox = new SpinBox( this );
   this.longitude_M_SpinBox.setRange( 0, 59 );
   this.longitude_M_SpinBox.setFixedWidth( editWidth );
   this.longitude_M_SpinBox.toolTip = "<p>Geodetic longitude of the observer, arcminutes.</p>";

   this.longitude_M_Label = new Label( this );
   this.longitude_M_Label.text = "'";
   this.longitude_M_Label.setFixedWidth( unitLabelWidth );

   this.longitude_S_NumericEdit = new NumericEdit( this );
   this.longitude_S_NumericEdit.setReal( true );
   this.longitude_S_NumericEdit.setPrecision( 2 );
   this.longitude_S_NumericEdit.setRange( 0, 60 );
   this.longitude_S_NumericEdit.enableFixedPrecision( true );
   this.longitude_S_NumericEdit.label.visible = false;
   this.longitude_S_NumericEdit.edit.setFixedWidth( editWidth );
   this.longitude_S_NumericEdit.toolTip = "<p>Geodetic longitude of the observer, arcseconds.</p>";

   this.longitude_S_Label = new Label( this );
   this.longitude_S_Label.text = "\"";
   this.longitude_S_Label.setFixedWidth( unitLabelWidth );

   this.longitudeIsWest_CheckBox = new CheckBox( this );
   this.longitudeIsWest_CheckBox.text = "West";
   this.longitudeIsWest_CheckBox.toolTip = "<p>When checked, the longitude is " +
      "negative (to the west of the reference meridian).</p>";

   this.longitude_Sizer = new HorizontalSizer;
   this.longitude_Sizer.spacing = 4;
   this.longitude_Sizer.add( this.longitude_Label );
   this.longitude_Sizer.add( this.longitude_D_SpinBox );
   this.longitude_Sizer.add( this.longitude_D_Label );
   this.longitude_Sizer.add( this.longitude_M_SpinBox );
   this.longitude_Sizer.add( this.longitude_M_Label );
   this.longitude_Sizer.add( this.longitude_S_NumericEdit );
   this.longitude_Sizer.add( this.longitude_S_Label );
   this.longitude_Sizer.add( this.longitudeIsWest_CheckBox );
   this.longitude_Sizer.addStretch();

   //

   this.latitude_Label = new Label( this );
   this.latitude_Label.text = "Latitude:";
   this.latitude_Label.toolTip = "<p>Observer position, geodetic latitude " +
      "(degrees, minutes and seconds or arc).</p>";
   this.latitude_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
   this.latitude_Label.setFixedWidth( labelWidth );

   this.latitude_D_SpinBox = new SpinBox( this );
   this.latitude_D_SpinBox.setRange( 0, 89 );
   this.latitude_D_SpinBox.setFixedWidth( editWidth );
   this.latitude_D_SpinBox.toolTip = "<p>Geodetic latitude of the observer, degrees.</p>";

   this.latitude_D_Label = new Label( this );
   this.latitude_D_Label.text = "\u00B0";
   this.latitude_D_Label.setFixedWidth( unitLabelWidth );

   this.latitude_M_SpinBox = new SpinBox( this );
   this.latitude_M_SpinBox.setRange( 0, 59 );
   this.latitude_M_SpinBox.setFixedWidth( editWidth );
   this.latitude_M_SpinBox.toolTip = "<p>Geodetic latitude of the observer, arcminutes.</p>";

   this.latitude_M_Label = new Label( this );
   this.latitude_M_Label.text = "'";
   this.latitude_M_Label.setFixedWidth( unitLabelWidth );

   this.latitude_S_NumericEdit = new NumericEdit( this );
   this.latitude_S_NumericEdit.setReal( true );
   this.latitude_S_NumericEdit.setPrecision( 2 );
   this.latitude_S_NumericEdit.setRange( 0, 60 );
   this.latitude_S_NumericEdit.enableFixedPrecision( true );
   this.latitude_S_NumericEdit.label.visible = false;
   this.latitude_S_NumericEdit.edit.setFixedWidth( editWidth );
   this.latitude_S_NumericEdit.toolTip = "<p>Geodetic latitude of the observer, arcseconds.</p>";

   this.latitude_S_Label = new Label( this );
   this.latitude_S_Label.text = "\"";
   this.latitude_S_Label.setFixedWidth( unitLabelWidth );

   this.latitudeIsSouth_CheckBox = new CheckBox( this );
   this.latitudeIsSouth_CheckBox.text = "South";
   this.latitudeIsSouth_CheckBox.toolTip = "<p>When checked, the latitude is " +
      "negative (southern hemisphere).</p>";

   this.latitude_Sizer = new HorizontalSizer;
   this.latitude_Sizer.spacing = 4;
   this.latitude_Sizer.add( this.latitude_Label );
   this.latitude_Sizer.add( this.latitude_D_SpinBox );
   this.latitude_Sizer.add( this.latitude_D_Label );
   this.latitude_Sizer.add( this.latitude_M_SpinBox );
   this.latitude_Sizer.add( this.latitude_M_Label );
   this.latitude_Sizer.add( this.latitude_S_NumericEdit );
   this.latitude_Sizer.add( this.latitude_S_Label );
   this.latitude_Sizer.add( this.latitudeIsSouth_CheckBox );
   this.latitude_Sizer.addStretch();

   //

   let height_ToolTip = "<p>Observer position, geodetic height in meters.</p>";

   this.height_M_Label = new Label( this );
   this.height_M_Label.text = "m";
   this.height_M_Label.textAlignment = TextAlign_Left | TextAlign_VertCenter;
   this.height_M_Label.setFixedWidth( unitLabelWidth );
   this.height_M_Label.toolTip = height_ToolTip;

   this.height_NumericEdit = new NumericEdit( this );
   this.height_NumericEdit.setReal( false );
   this.height_NumericEdit.setRange( 0, 1e+07 );
   this.height_NumericEdit.label.text = "Height:";
   this.height_NumericEdit.label.setFixedWidth( labelWidth );
   this.height_NumericEdit.sizer.add( this.height_M_Label );
   this.height_NumericEdit.sizer.addStretch();
   this.height_NumericEdit.toolTip = height_ToolTip;

   //

   this.sizer = new VerticalSizer;
   this.sizer.spacing = 4;
   this.sizer.add( this.longitude_Sizer );
   this.sizer.add( this.latitude_Sizer );
   this.sizer.add( this.height_NumericEdit );
   this.sizer.addStretch();

   //

   this.longitude = function()
   {
      return ( this.longitude_D_SpinBox.value +
            ( this.longitude_M_SpinBox.value +
               this.longitude_S_NumericEdit.value / 60 ) / 60 ) *
         ( this.longitudeIsWest_CheckBox.checked ? -1 : +1 );
   };

   this.latitude = function()
   {
      return ( this.latitude_D_SpinBox.value +
            ( this.latitude_M_SpinBox.value +
               this.latitude_S_NumericEdit.value / 60 ) / 60 ) *
         ( this.latitudeIsSouth_CheckBox.checked ? -1 : +1 );
   };

   this.altitude = function()
   {
      return this.height_NumericEdit.value;
   };

   //

   this.setLongitude = function( lon )
   {
      let l = lon;
      if ( l > 180 )
         l -= 360;
      let s = Math.decimalToSexagesimal( l );
      s[ 3 ] = Math.roundTo( s[ 3 ], 2 );
      if ( s[ 3 ] > 59.99 )
      {
         s[ 3 ] = 0;
         if ( ++s[ 2 ] == 60 )
         {
            s[ 2 ] = 0;
            ++s[ 1 ];
         }
      }
      this.longitude_D_SpinBox.value = s[ 1 ];
      this.longitude_M_SpinBox.value = s[ 2 ];
      this.longitude_S_NumericEdit.setValue( s[ 3 ] );
      this.longitudeIsWest_CheckBox.checked = s[ 0 ] < 0;
   };

   this.setLatitude = function( lat )
   {
      let s = Math.decimalToSexagesimal( lat );
      s[ 3 ] = Math.roundTo( s[ 3 ], 2 );
      if ( s[ 3 ] > 59.99 )
      {
         s[ 3 ] = 0;
         if ( ++s[ 2 ] == 60 )
         {
            s[ 2 ] = 0;
            ++s[ 1 ];
         }
      }
      this.latitude_D_SpinBox.value = s[ 1 ];
      this.latitude_M_SpinBox.value = s[ 2 ];
      this.latitude_S_NumericEdit.setValue( s[ 3 ] );
      this.latitudeIsSouth_CheckBox.checked = s[ 0 ] < 0;
   };

   this.setAltitude = function( hgt )
   {
      this.height_NumericEdit.setValue( hgt );
   };

   //

   this.setLongitude( longitude );
   this.setLatitude( latitude );
   this.setAltitude( altitude );
}

GeodeticCoordinatesEditor.prototype = new Control();

// ----------------------------------------------------------------------------

#endif
