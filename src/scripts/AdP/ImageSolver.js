/*
 * Image Plate Solver
 *
 * Plate solving of astronomical images.
 *
 * Copyright (C) 2012-2023, Andres del Pozo
 * Copyright (C) 2019-2023, Juan Conejero (PTeam)
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

/*
 * Coordinate Spaces
 *
 * (I) Image Coordinates
 *    Pixels of the image on the PixInsight platform.
 *    - Increases from left to right and top to bottom.
 *    - The center of the top left pixel has image coordinates (0.5,0.5).
 *
 * (G) Gnomonic Projected Space
 *    Projected space, result of projecting celestial coordinates using a
 *    Gnomonic projection.
 *    - Coincides with the World Intermediate Coordinates of WCS.
 *    - Increases from right to left and bottom to top.
 *    - The center of the image has coordinates (0,0).
 *
 * (F) FITS WCS Coordinates
 *    Pixels of the image using WCS conventions.
 *    - http://fits.gsfc.nasa.gov/fits_wcs.html
 *      "Representations of World Coordinates in FITS" (Sections 2.1.4 and 5.1)
 *      "Representations of celestial coordinates in FITS" (Section 5, p. 1085)
 *    - Increases from left to right and bottom to top.
 *    - The center of the bottom left pixel has the coordinates (1,1).
 */

/* beautify ignore:start */
#feature-id    ImageSolver : Image Analysis > ImageSolver

#feature-icon  @script_icons_dir/ImageSolver.svg

#feature-info  A script for plate-solving astronomical images.<br/>\
               <br/>\
               Copyright &copy; 2012-2023 Andr&eacute;s del Pozo<br/>\
               Copyright &copy; 2019-2023 Juan Conejero (PTeam)

#ifndef USE_SOLVER_LIBRARY
// Global control variable for PCL invocation.
var __PJSR_AdpImageSolver_SuccessCount = 0;
#endif

if ( CoreApplication === undefined ||
     CoreApplication.versionRevision === undefined ||
     CoreApplication.versionMajor*1e11
   + CoreApplication.versionMinor*1e8
   + CoreApplication.versionRelease*1e5
   + CoreApplication.versionRevision*1e2 < 100800900200 )
{
   throw new Error( "This script requires PixInsight core version 1.8.9-2 or higher." );
}

#define __PJSR_USE_STAR_DETECTOR_V2

#include <pjsr/BRQuadTree.jsh>
#include <pjsr/ColorSpace.jsh>
#include <pjsr/DataType.jsh>
#include <pjsr/FrameStyle.jsh>
#include <pjsr/NumericControl.jsh>
#include <pjsr/SectionBar.jsh>
#include <pjsr/Sizer.jsh>
#include <pjsr/StarDetector.jsh>
#include <pjsr/StdButton.jsh>
#include <pjsr/StdCursor.jsh>
#include <pjsr/StdIcon.jsh>
#include <pjsr/TextAlign.jsh>
#include <pjsr/UndoFlag.jsh>

#define SOLVERVERSION "6.0"

#ifndef USE_SOLVER_LIBRARY
#define TITLE "Image Solver"
#define SETTINGS_MODULE "SOLVER"
//#define DEBUG

#include "WCSmetadata.jsh"
#include "AstronomicalCatalogs.jsh"
#include "SearchCoordinatesDialog.js"
#include "OptimizeSplineCoordinates.js"
#include "CatalogDownloader.js"

#define STAR_CSV_FILE   File.systemTempDirectory + "/stars.csv"
#endif // !USE_SOLVER_LIBRARY

#define SETTINGS_MODULE_SCRIPT "SOLVER"

/* beautify ignore:end */

/*
 * Enumerations
 */
function CatalogMode()
{}
CatalogMode.prototype.LocalText = 0;
CatalogMode.prototype.Online = 1;
CatalogMode.prototype.Automatic = 2;
CatalogMode.prototype.LocalXPSDServer = 3;

/*
 * SolverConfiguration: Configuration information of the ImageSolver engine.
 */
function SolverConfiguration( module )
{
   this.__base__ = ObjectWithSettings;
   this.__base__(
      module,
      "solver",
      new Array(
         [ "version", DataType_UCString ],
         [ "magnitude", DataType_Float ],
         [ "autoMagnitude", DataType_Boolean ],
         [ "databasePath", DataType_UCString ],
         [ "generateErrorImg", DataType_Boolean ],
         [ "structureLayers", DataType_UInt8 ],
         [ "minStructureSize", DataType_UInt8 ],
         [ "hotPixelFilterRadius", DataType_UInt8 ],
         [ "noiseReductionFilterRadius", DataType_UInt8 ],
         [ "sensitivity", DataType_Double ],
         [ "peakResponse", DataType_Double ],
         [ "brightThreshold", DataType_Double ],
         [ "maxStarDistortion", DataType_Double ],
         [ "autoPSF", DataType_Boolean ],
         [ "catalogMode", DataType_UInt8 ],
         [ "vizierServer", DataType_UCString ],
         [ "showStars", DataType_Boolean ],
         [ "showSimplifiedSurfaces", DataType_Boolean ],
         [ "showDistortion", DataType_Boolean ],
         [ "generateDistortModel", DataType_Boolean ],
         [ "catalog", DataType_UCString ],
         [ "distortionCorrection", DataType_Boolean ],
         [ "splineOrder", DataType_UInt8 ],
         [ "splineSmoothing", DataType_Float ],
         [ "enableSimplifier", DataType_Boolean ],
         [ "simplifierRejectFraction", DataType_Float ],
         [ "useDistortionModel", DataType_Boolean ],
         [ "distortionModelPath", DataType_UCString ],
         [ "onlyOptimize", DataType_Boolean ],
         [ "useActive", DataType_Boolean ],
         [ "outSuffix", DataType_UCString ],
         [ "files", Ext_DataType_StringArray ],
         [ "projection", DataType_UInt8 ],
         [ "projectionOriginMode", DataType_UInt8 ],
         [ "distortedCorners", DataType_Boolean ],
         [ "optimizeSolution", DataType_Boolean ],
         [ "restrictToHQStars", DataType_Boolean ]
      )
   );

   this.version = SOLVERVERSION;
   this.useActive = true;
   this.files = [];
   this.catalogMode = CatalogMode.prototype.Automatic;
   this.availableCatalogs = [ new UCAC3Catalog(),
      new PPMXLCatalog(),
      new TychoCatalog(),
      new HR_Catalog(),
      new GaiaDR2_Catalog()
   ];
   this.availableXPSDServers = [ new GaiaDR3XPSDCatalog(),
      new GaiaEDR3XPSDCatalog(),
      new GaiaDR2XPSDCatalog()
   ];
   this.vizierServer = "https://vizier.cds.unistra.fr/";
   this.magnitude = 12;
   this.maxIterations = 100;
   this.structureLayers = 5;
   this.minStructureSize = 0;
   this.hotPixelFilterRadius = 1;
   this.noiseReductionFilterRadius = 0;
   this.sensitivity = 0.5;
   this.peakResponse = 0.5;
   this.brightThreshold = 3.0;
   this.maxStarDistortion = 0.6;
   this.autoPSF = false;
   this.generateErrorImg = false;
   this.showStars = false;
   this.catalog = "PPMXL";
   this.autoMagnitude = true;
   this.showSimplifiedSurfaces = false;
   this.showDistortion = false;
   this.distortionCorrection = true;
   this.splineOrder = 2;
   this.splineSmoothing = 0.010;
   this.enableSimplifier = true;
   this.simplifierRejectFraction = 0.10;
   this.generateDistortModel = false;
   this.onlyOptimize = false;
   this.useDistortionModel = false;
   this.distortionModelPath = null;
   this.outSuffix = "_WCS";
   this.projection = 0;
   this.projectionOriginMode = 0;
   this.distortedCorners = false;
   this.optimizeSolution = true;
   this.restrictToHQStars = false;

   this.ResetSettings = function()
   {
      Settings.remove( SETTINGS_MODULE );
   };
}

SolverConfiguration.prototype = new ObjectWithSettings;

// ----------------------------------------------------------------------------

/*
 * ImageSolverDialog: Configuration dialog for the plate solver.
 */
function ImageSolverDialog( solverCfg, metadata, showTargetImage )
{
   this.__base__ = Dialog;
   this.__base__();

   let labelWidth1 = this.font.width( "Minimum structure size:" + "M" );
   let radioLabelWidth = this.font.width( "Focal distance:" + "M" );
   let spinBoxWidth = 7 * this.font.width( 'M' );

   this.solverCfg = solverCfg;
   this.metadata = metadata;

   this.helpLabel = new Label( this );
   this.helpLabel.frameStyle = FrameStyle_Box;
   this.helpLabel.minWidth = 45 * this.font.width( 'M' );
   this.helpLabel.margin = 6;
   this.helpLabel.wordWrapping = true;
   this.helpLabel.useRichText = true;
   this.helpLabel.text = "<p><b>ImageSolver v" + SOLVERVERSION + "</b> &mdash; " +
      "A script for plate solving astronomical images.<br/>" +
      "Copyright &copy; 2012-2023 Andr&eacute;s del Pozo | &copy; 2019-2023 Juan Conejero (PTeam)</p>";

   function toggleSectionHandler( section, toggleBegin )
   {
      if ( !toggleBegin )
      {
         section.dialog.setVariableHeight();
         section.dialog.adjustToContents();
         if ( section.dialog.targetImage_Section && section.dialog.targetImage_Section.isCollapsed() ||
            section.dialog.solverCfg.useActive )
            section.dialog.setFixedHeight();
         else
            section.dialog.setMinHeight();
      }
   }

   // -------------------------------------------------------------------------
   // Target Image
   // -------------------------------------------------------------------------

   if ( showTargetImage )
   {
      let hasActiveWindow = ImageWindow.activeWindow && ImageWindow.activeWindow.isWindow;
      if ( !hasActiveWindow )
         this.solverCfg.useActive = false;

      //

      this.activeWindow_RadioButton = new RadioButton( this );
      this.activeWindow_RadioButton.text = "Active window";
      this.activeWindow_RadioButton.checked = this.solverCfg.useActive == true;
      this.activeWindow_RadioButton.minWidth = labelWidth1;
      this.activeWindow_RadioButton.toolTip = "<p>The script solves the image in the active window.</p>";
      this.activeWindow_RadioButton.enabled = hasActiveWindow;
      this.activeWindow_RadioButton.onCheck = function( checked )
      {
         this.dialog.solverCfg.useActive = true;
         this.dialog.EnableFileControls();
      };

      this.activeWindow_Sizer = new HorizontalSizer;
      this.activeWindow_Sizer.addUnscaledSpacing( labelWidth1 + this.logicalPixelsToPhysical( 4 ) );
      this.activeWindow_Sizer.add( this.activeWindow_RadioButton );
      this.activeWindow_Sizer.addStretch();

      //

      this.listOfFiles_RadioButton = new RadioButton( this );
      this.listOfFiles_RadioButton.text = "List of files";
      this.listOfFiles_RadioButton.checked = !this.solverCfg.useActive;
      this.listOfFiles_RadioButton.minWidth = labelWidth1;
      this.listOfFiles_RadioButton.toolTip = "<p>The script solves the images in a list of files.</p>";
      this.listOfFiles_RadioButton.onCheck = function( checked )
      {
         this.dialog.solverCfg.useActive = false;
         this.dialog.EnableFileControls();
      };

      this.listOfFiles_Sizer = new HorizontalSizer;
      this.listOfFiles_Sizer.addUnscaledSpacing( labelWidth1 + this.logicalPixelsToPhysical( 4 ) );
      this.listOfFiles_Sizer.add( this.listOfFiles_RadioButton );
      this.listOfFiles_Sizer.addStretch();

      //

      this.fileList_TreeBox = new TreeBox( this );
      this.fileList_TreeBox.rootDecoration = false;
      this.fileList_TreeBox.alternateRowColor = true;
      this.fileList_TreeBox.multipleSelection = true;
      this.fileList_TreeBox.headerVisible = false;
      this.fileList_TreeBox.setMinHeight( this.font.pixelSize * 11 );
      this.fileList_TreeBox.numberOfColumns = 2;
      this.fileList_TreeBox.showColumn( 1, false );
      this.fileList_TreeBox.toolTip = "<p>List of files for which the geometry will be computed.</p>";
      if ( this.solverCfg.files )
      {
         for ( let i = 0; i < this.solverCfg.files.length; ++i )
         {
            let node = new TreeBoxNode( this.fileList_TreeBox );
            node.setText( 0, this.solverCfg.files[i] );
         }
      }
      else
         this.solverCfg.files = new Array();

      //

      this.addFiles_Button = new PushButton( this );
      this.addFiles_Button.text = "Add files";
      this.addFiles_Button.toolTip = "Add files to the list";
      this.addFiles_Button.onMousePress = function()
      {
         let ofd = new OpenFileDialog;
         ofd.multipleSelections = true;
         ofd.caption = "Select files";
         //ofd.loadImageFilters();
         ofd.filters = [
            [ "All supported formats", ".xisf", ".fit", ".fits", ".fts" ],
            [ "XISF Files", ".xisf" ],
            [ "FITS Files", ".fit", ".fits", ".fts" ]
         ];
         if ( ofd.execute() )
         {
            for ( let i = 0; i < ofd.fileNames.length; ++i )
            {
               this.dialog.solverCfg.files.push( ofd.fileNames[i] );
               let node = new TreeBoxNode( this.dialog.fileList_TreeBox );
               node.checkable = false;
               node.setText( 0, ofd.fileNames[i] );
            }
            this.dialog.fileList_TreeBox.adjustColumnWidthToContents( 1 );
         }
      };

      //

      this.removeFiles_Button = new PushButton( this );
      this.removeFiles_Button.text = "Remove files";
      this.removeFiles_Button.toolTip = "<p>Removes the selected files from the list.</p>";
      this.removeFiles_Button.onMousePress = function()
      {
         for ( let i = this.dialog.fileList_TreeBox.numberOfChildren - 1; i >= 0; --i )
            if ( this.dialog.fileList_TreeBox.child( i ).selected )
            {
               this.dialog.solverCfg.files.splice( i, 1 );
               this.dialog.fileList_TreeBox.remove( i );
            }
      };

      //

      this.clearFiles_Button = new PushButton( this );
      this.clearFiles_Button.text = "Clear files";
      this.clearFiles_Button.toolTip = "<p>Clears the list of files.</p>";
      this.clearFiles_Button.onMousePress = function()
      {
         this.dialog.fileList_TreeBox.clear();
         this.dialog.solverCfg.files = new Array();
      };

      //

      this.fileButtons_Sizer = new VerticalSizer;
      this.fileButtons_Sizer.spacing = 6;
      this.fileButtons_Sizer.add( this.addFiles_Button );
      this.fileButtons_Sizer.add( this.removeFiles_Button );
      this.fileButtons_Sizer.addSpacing( 8 );
      this.fileButtons_Sizer.add( this.clearFiles_Button );
      this.fileButtons_Sizer.addStretch();

      //

      this.outputFileSuffix_Label = new fieldLabel( this, "Output file suffix:", labelWidth1 - 4 );

      this.outputFileSuffix_Edit = new Edit( this );
      this.outputFileSuffix_Edit.text = this.solverCfg.outSuffix ? this.solverCfg.outSuffix : "";
      this.outputFileSuffix_Edit.toolTip = "<p>This suffix will be appended to each file name " +
         "when saving the astrometric solution.</p>" +
         "<p>If this suffix is empty, original input files will be overwritten.</p>";
      this.outputFileSuffix_Edit.onTextUpdated = function( value )
      {
         this.dialog.solverCfg.outSuffix = value ? value.trim() : "";
      };

      this.outputFileSuffix_Sizer = new HorizontalSizer;
      this.outputFileSuffix_Sizer.spacing = 6;
      this.outputFileSuffix_Sizer.add( this.outputFileSuffix_Label );
      this.outputFileSuffix_Sizer.add( this.outputFileSuffix_Edit );
      this.outputFileSuffix_Sizer.addStretch();

      //

      this.files_Sizer2 = new HorizontalSizer;
      this.files_Sizer2.spacing = 6;
      this.files_Sizer2.add( this.fileList_TreeBox, 100 );
      this.files_Sizer2.add( this.fileButtons_Sizer );

      this.files_Control = new Control( this );
      this.files_Sizer = new VerticalSizer;
      this.files_Sizer.spacing = 6;
      this.files_Sizer.add( this.files_Sizer2, 100 );
      this.files_Sizer.add( this.outputFileSuffix_Sizer );
      this.files_Control.sizer = this.files_Sizer;

      //

      this.EnableFileControls = function()
      {
         this.fileList_TreeBox.enabled = !this.solverCfg.useActive;
         this.addFiles_Button.enabled = !this.solverCfg.useActive;
         this.removeFiles_Button.enabled = !this.solverCfg.useActive;
         this.clearFiles_Button.enabled = !this.solverCfg.useActive;
         this.files_Control.visible = !this.solverCfg.useActive;
         this.setVariableHeight();
         this.targetImage_Control.setVariableHeight();
         this.targetImage_Control.adjustToContents();
         this.adjustToContents();
         if ( this.solverCfg.useActive )
         {
            this.targetImage_Control.setFixedSize();
            this.setFixedSize();
         }
         else
         {
            this.targetImage_Control.setMinHeight();
            this.setMinHeight();
         }
      };

      //

      this.targetImage_Control = new Control( this )
      this.targetImage_Control.sizer = new VerticalSizer;
      this.targetImage_Control.sizer.margin = 6;
      this.targetImage_Control.sizer.spacing = 4;
      this.targetImage_Control.sizer.add( this.activeWindow_Sizer );
      this.targetImage_Control.sizer.add( this.listOfFiles_Sizer );
      this.targetImage_Control.sizer.add( this.files_Control, 100 );

      this.targetImage_Section = new SectionBar( this, "Target Image" );
      this.targetImage_Section.setSection( this.targetImage_Control );
      this.targetImage_Section.onToggleSection = toggleSectionHandler;
   } // if ( showTargetImage )

   // -------------------------------------------------------------------------
   // Image Parameters
   // -------------------------------------------------------------------------

   this.onlyApplyOptimization_CheckBox = new CheckBox( this );
   this.onlyApplyOptimization_CheckBox.text = "Only apply optimization";
   this.onlyApplyOptimization_CheckBox.checked = this.solverCfg.onlyOptimize != null && this.solverCfg.onlyOptimize;
   this.onlyApplyOptimization_CheckBox.toolTip = "<p>The solver assumes that the image is already solved, and " +
      "only optimizes the result using the current parameters.</p>";
   this.onlyApplyOptimization_CheckBox.onCheck = function( checked )
   {
      this.dialog.solverCfg.onlyOptimize = checked;
      this.dialog.coordinatesEpochAndScale_Control.enabled = !checked;
      this.dialog.optimizeSol_CheckBox.enabled = !checked;
   };

   this.onlyApplyOptimization_Sizer = new HorizontalSizer;
   this.onlyApplyOptimization_Sizer.addUnscaledSpacing( labelWidth1 + this.logicalPixelsToPhysical( 4 ) );
   this.onlyApplyOptimization_Sizer.add( this.onlyApplyOptimization_CheckBox );
   this.onlyApplyOptimization_Sizer.addStretch();

   // Target object specifications

   let coordinatesTooltip = "<p>Initial equatorial coordinates. Must be inside the image.</p>";

   // CoordsEditor
   this.coords_Editor = new CoordinatesEditor( this,
      new Point( ( this.metadata.ra !== null ) ? this.metadata.ra : 0,
         ( this.metadata.dec !== null ) ? this.metadata.dec : 0 ),
      labelWidth1, spinBoxWidth, coordinatesTooltip );

   this.search_Button = new PushButton( this );
   this.search_Button.text = "Search";
   this.search_Button.icon = this.scaledResource( ":/icons/find.png" );
   this.search_Button.onClick = function()
   {
      let search = new SearchCoordinatesDialog( null, true, false );
      search.windowTitle = "Online Coordinate Search";
      if ( search.execute() )
      {
         let object = search.object;
         if ( !object )
            return;
         this.dialog.coords_Editor.SetCoords( object.posEq );
      }
   };

   this.coords_Sizer = new HorizontalSizer;
   this.coords_Sizer.spacing = 8;
   this.coords_Sizer.add( this.coords_Editor );
   this.coords_Sizer.addStretch();
   this.coords_Sizer.add( this.search_Button );

   //

   this.dateTime_Editor = new DateTimeEditor( this,
      this.metadata.observationTime,
      labelWidth1, spinBoxWidth, true /*withTimeControls*/ );
   //

   this.topocentric_CheckBox = new CheckBox( this );
   this.topocentric_CheckBox.text = "Topocentric";
   this.topocentric_CheckBox.toolTip = "<p>Compute topocentric star places.</p>" +
      "<p>When this option is enabled, astrometric and proper star positions are computed with respect to the observation location " +
      "relative to the Earth's center of mass, as defined by the geodetic coordinates specified below: longitude, latitude, and height. " +
      "When this option is disabled, star positions are computed relative to the geocenter.</p>" +
      "<p>For generation of astrometric solutions in the International Celestial Reference System (ICRS), the observation location " +
      "is only used to compute diurnal parallax corrections, which are very small for distant objects and hence can be neglected in most " +
      "practical applications.</p>" +
      "<p>For astrometric solutions in the Geocentric Celestial Reference System (GCRS), the geodetic coordinates of the observer are " +
      "used to compute diurnal aberration and parallax corrections. Diurnal aberration is caused by the velocity of the observer on or " +
      "near the surface of the rotating Earth. The effect of diurnal aberration is relatively small (a maximum of about 0.32 arcseconds " +
      "for an observer at the Equator), but not negligible for astrometric solutions in the GCRS.</p>" +
      "<p>Besides generation of astrometric solutions in different coordinate reference systems, the position of the observer is necessary " +
      "to find and annotate solar system bodies accurately in astrometrically solved images.</p>" +
      "<p>All of the corrections and procedures described above require accurate geodetic coordinates of the observation location: " +
      "longitude and latitude in degrees and height in meters, as specified in the controls below.</p>";
   this.topocentric_CheckBox.checked = this.metadata.topocentric;
   this.topocentric_CheckBox.onCheck = function( checked )
   {
      this.dialog.metadata.topocentric = checked;
      this.dialog.observerData_Control.enabled = checked;
   };

   this.topocentric_Sizer = new HorizontalSizer;
   this.topocentric_Sizer.addUnscaledSpacing( labelWidth1 + this.logicalPixelsToPhysical( 4 ) );
   this.topocentric_Sizer.add( this.topocentric_CheckBox );
   this.topocentric_Sizer.addStretch();

   this.observerData_Control = new GeodeticCoordinatesEditor( this,
      this.metadata.obsLongitude ? this.metadata.obsLongitude : 0,
      this.metadata.obsLatitude ? this.metadata.obsLatitude : 0,
      this.metadata.obsHeight ? this.metadata.obsHeight : 0,
      labelWidth1, spinBoxWidth );

   this.observerData_Control.enabled = this.metadata.topocentric;

   //

   this.metadata.useFocal = this.metadata.useFocal && this.metadata.xpixsz != null && this.metadata.xpixsz > 0;

   this.focal_RadioButton = new RadioButton( this );
   this.focal_RadioButton.checked = this.metadata.useFocal;
   this.focal_RadioButton.enabled = this.metadata.xpixsz != null && this.metadata.xpixsz > 0;
   this.focal_RadioButton.onCheck = function( value )
   {
      this.dialog.focal_Edit.enabled = value;
      this.dialog.metadata.useFocal = true;
   };

   this.focal_Label = new Label( this );
   this.focal_Label.textAlignment = TextAlign_Left | TextAlign_VertCenter;
   this.focal_Label.text = "Focal distance:";
   this.focal_Label.setFixedWidth( radioLabelWidth );
   this.focal_Label.mouseTracking = true;
   this.focal_Label.onMouseRelease = function()
   {
      if ( this.dialog.focal_RadioButton.enabled )
      {
         this.dialog.focal_RadioButton.checked = true;
         this.dialog.focal_RadioButton.onCheck( true );
      }
   };

   this.focal_Edit = new Edit( this );
   this.focal_Edit.text = format( "%g", this.metadata.focal );
   this.focal_Edit.toolTip = "<p>Effective focal length of the optical system in millimeters.</p>" +
      "<p>It doesn't need to be the exact value, but it should not be more than a 50% off" +
      "&mdash;the closer the better.</p>";
   this.focal_Edit.setFixedWidth( spinBoxWidth );
   this.focal_Edit.enabled = this.metadata.useFocal;
   this.focal_Edit.onTextUpdated = function( value )
   {
      this.dialog.metadata.focal = parseFloat( value );
      if ( this.dialog.metadata.xpixsz )
      {
         this.dialog.metadata.resolution = ( this.dialog.metadata.focal > 0 ) ?
            this.dialog.metadata.xpixsz / this.dialog.metadata.focal * 0.18 / Math.PI : 0;
         this.dialog.resolution_Edit.text = format( "%g", this.dialog.metadata.resolution * 3600 );
      }
   };

   this.focal_mm_Label = new Label( this );
   this.focal_mm_Label.text = "mm";

   this.resolution_RadioButton = new RadioButton( this );
   this.resolution_RadioButton.checked = !this.metadata.useFocal;
   this.resolution_RadioButton.onCheck = function( value )
   {
      this.dialog.resolution_Edit.enabled = value;
      this.dialog.metadata.useFocal = false;
   };

   this.resolution_Label = new Label( this );
   this.resolution_Label.textAlignment = TextAlign_Left | TextAlign_VertCenter;
   this.resolution_Label.text = "Resolution:";
   this.resolution_Label.setFixedWidth( radioLabelWidth );
   this.resolution_Label.mouseTracking = true;
   this.resolution_Label.onMouseRelease = function()
   {
      this.dialog.resolution_RadioButton.checked = true;
      this.dialog.resolution_RadioButton.onCheck( true );
   };

   this.resolution_Edit = new Edit( this );
   if ( this.metadata.resolution != null )
      this.resolution_Edit.text = format( "%g", this.metadata.resolution * 3600 );
   this.resolution_Edit.toolTip = "<p>Resolution of the image in arcseconds per pixel.</p>" +
      "<p>It doesn't need to be the exact value, but it should not be more than a 50% off" +
      "&mdash;the closer the better.</p>";
   this.resolution_Edit.setFixedWidth( spinBoxWidth );
   this.resolution_Edit.enabled = !this.metadata.useFocal;
   this.resolution_Edit.onTextUpdated = function( value )
   {
      this.dialog.metadata.resolution = parseFloat( value ) / 3600;
      if ( this.dialog.metadata.xpixsz )
      {
         this.dialog.metadata.focal = ( this.dialog.metadata.resolution > 0 ) ?
            this.dialog.metadata.xpixsz / this.dialog.metadata.resolution * 0.18 / Math.PI : 0;
         this.dialog.focal_Edit.text = format( "%g", this.dialog.metadata.focal );
      }
   };

   this.resolution_asp_Label = new Label( this );
   this.resolution_asp_Label.text = "\"/px";

   this.focal_Sizer = new HorizontalSizer;
   this.focal_Sizer.spacing = 4;
   this.focal_Sizer.add( this.focal_RadioButton );
   this.focal_Sizer.add( this.focal_Label );
   this.focal_Sizer.add( this.focal_Edit );
   this.focal_Sizer.add( this.focal_mm_Label );
   this.focal_Sizer.addStretch();

   this.resolution_Sizer = new HorizontalSizer;
   this.resolution_Sizer.spacing = 4;
   this.resolution_Sizer.add( this.resolution_RadioButton );
   this.resolution_Sizer.add( this.resolution_Label );
   this.resolution_Sizer.add( this.resolution_Edit );
   this.resolution_Sizer.add( this.resolution_asp_Label );
   this.resolution_Sizer.addStretch();

   //

   this.scaleStack_Sizer = new VerticalSizer;
   this.scaleStack_Sizer.spacing = 4;
   this.scaleStack_Sizer.add( this.focal_Sizer );
   this.scaleStack_Sizer.add( this.resolution_Sizer );

   //

   this.scale_Label = new fieldLabel( this, "Image scale:", labelWidth1 );
   this.scale_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;

   this.scaleBracket_Label = new Label( this );
   this.scaleBracket_Label.textAlignment = TextAlign_VertCenter;
   this.scaleBracket_Label.text = '[';
   this.scaleBracket_Label.font = new Font( "DejaVu Sans Mono", this.font.pointSize * 2 );

   this.scale_Sizer = new HorizontalSizer;
   this.scale_Sizer.spacing = 4;
   this.scale_Sizer.add( this.scale_Label );
   this.scale_Sizer.add( this.scaleBracket_Label );
   this.scale_Sizer.add( this.scaleStack_Sizer );
   this.scale_Sizer.addStretch();

   //

   this.pixelSize_Label = new fieldLabel( this, "Pixel size:", labelWidth1 );

   this.pixelSize_Edit = new Edit( this );
   this.pixelSize_Edit.text = ( this.metadata.xpixsz == null ) ? "7" : format( "%g", this.metadata.xpixsz );
   this.pixelSize_Edit.toolTip = "<p>Pixel size in micrometers. " +
      "The image is assumed to have square pixels.</p>";
   this.pixelSize_Edit.setFixedWidth( spinBoxWidth );
   this.pixelSize_Edit.onTextUpdated = function( value )
   {
      this.dialog.metadata.xpixsz = ( value != null ) ? parseFloat( value ) : 0;
      if ( this.dialog.metadata.xpixsz > 0 && this.dialog.metadata.xpixsz < 3600 )
      {
         this.dialog.focal_RadioButton.enabled = true;
         if ( this.dialog.metadata.useFocal )
         {
            this.dialog.metadata.resolution = ( this.dialog.metadata.focal > 0 ) ?
               this.dialog.metadata.xpixsz / this.dialog.metadata.focal * 0.18 / Math.PI : 0;
            this.dialog.resolution_Edit.text = format( "%g", this.dialog.metadata.resolution * 3600 );
         }
         else
         {
            this.dialog.metadata.focal = ( this.dialog.metadata.resolution > 0 ) ?
               this.dialog.metadata.xpixsz / this.dialog.metadata.resolution * 0.18 / Math.PI : 0;
            this.dialog.focal_Edit.text = format( "%g", this.dialog.metadata.focal );
         }
      }
      else
      {
         this.dialog.focal_RadioButton.enabled = false;
         this.dialog.metadata.useFocal = false;
         this.dialog.resolution_RadioButton.checked = true;
         this.dialog.resolution_Edit.enabled = true;
      }
   };

   this.pixelSize_um_Label = new Label( this );
   this.pixelSize_um_Label.text = "\u03BCm";

   this.pixelSize_Sizer = new HorizontalSizer;
   this.pixelSize_Sizer.spacing = 4;
   this.pixelSize_Sizer.add( this.pixelSize_Label );
   this.pixelSize_Sizer.add( this.pixelSize_Edit );
   this.pixelSize_Sizer.add( this.pixelSize_um_Label );
   this.pixelSize_Sizer.addStretch();

   //

   this.coordinatesEpochAndScale_Control = new Control( this );
   this.coordinatesEpochAndScale_Control.sizer = new VerticalSizer;
   this.coordinatesEpochAndScale_Control.sizer.margin = 0;
   this.coordinatesEpochAndScale_Control.sizer.spacing = 4;
   this.coordinatesEpochAndScale_Control.sizer.add( this.coords_Sizer );
   this.coordinatesEpochAndScale_Control.sizer.add( this.dateTime_Editor );
   this.coordinatesEpochAndScale_Control.sizer.add( this.topocentric_Sizer );
   this.coordinatesEpochAndScale_Control.sizer.add( this.observerData_Control );
   this.coordinatesEpochAndScale_Control.sizer.add( this.scale_Sizer );
   this.coordinatesEpochAndScale_Control.sizer.add( this.pixelSize_Sizer );
   this.coordinatesEpochAndScale_Control.enabled = !this.solverCfg.onlyOptimize;

   //

   this.imageParameters_Control = new Control( this )

   this.imageParameters_Control.sizer = new VerticalSizer;
   this.imageParameters_Control.sizer.margin = 6;
   this.imageParameters_Control.sizer.spacing = 4;
   this.imageParameters_Control.sizer.add( this.onlyApplyOptimization_Sizer );
   this.imageParameters_Control.sizer.addSpacing( 4 );
   this.imageParameters_Control.sizer.add( this.coordinatesEpochAndScale_Control );

   this.imageParameters_Section = new SectionBar( this, "Image Parameters" );
   this.imageParameters_Section.setSection( this.imageParameters_Control );
   this.imageParameters_Section.onToggleSection = toggleSectionHandler;

   // -------------------------------------------------------------------------
   // Model Parameters
   // -------------------------------------------------------------------------

   this.referenceSystem_Label = new fieldLabel( this, "Reference system:", labelWidth1 );

   this.referenceSystem_ComboBox = new ComboBox( this );
   this.referenceSystem_ComboBox.editEnabled = false;
   this.referenceSystem_ComboBox.addItem( "ICRS" );
   this.referenceSystem_ComboBox.addItem( "GCRS" );
   //    this.referenceSystem_ComboBox.addItem( "Geocentric apparent coordinates" );
   switch ( this.dialog.metadata.referenceSystem )
   {
   default:
   case "ICRS":
      this.referenceSystem_ComboBox.currentItem = 0;
      break;
   case "GCRS":
      this.referenceSystem_ComboBox.currentItem = 1;
      break;
   }
   this.referenceSystem_ComboBox.toolTip = "<p>Reference system of celestial coordinates:</p>" +
      "<p><b>ICRS</b> (International Celestial Reference System). The image solver will use astrometric " +
      "positions computed from catalog star coordinates and properties. This includes space motion (proper " +
      "motions, parallax and radial velocity, when available) and gravitational deflection of light.</p>" +
      "<p><b>GCRS</b> (Geocentric Celestial Reference System). The image solver will use proper positions. " +
      "These include the same transformations applied to compute astrometric positions, plus annual and diurnal " +
      "aberration (rigorous relativistic model) to obtain the true direction of each source as seen by the observer.</p>";
   this.referenceSystem_ComboBox.onItemSelected = function()
   {
      switch ( this.dialog.referenceSystem_ComboBox.currentItem )
      {
      default:
      case 0:
         this.dialog.metadata.referenceSystem = "ICRS";
         break;
      case 1:
         this.dialog.metadata.referenceSystem = "GCRS";
         break;
      }
   };

   this.referenceSystem_Sizer = new HorizontalSizer;
   this.referenceSystem_Sizer.spacing = 4;
   this.referenceSystem_Sizer.add( this.referenceSystem_Label );
   this.referenceSystem_Sizer.add( this.referenceSystem_ComboBox );
   this.referenceSystem_Sizer.addStretch();

   //

   this.automaticCatalog_RadioButton = new RadioButton( this );
   this.automaticCatalog_RadioButton.text = "Automatic catalog";
   this.automaticCatalog_RadioButton.textAlignment = TextAlign_Right | TextAlign_VertCenter;
   this.automaticCatalog_RadioButton.setMinWidth( labelWidth1 );
   this.automaticCatalog_RadioButton.checked = this.solverCfg.catalogMode == CatalogMode.prototype.Automatic;
   this.automaticCatalog_RadioButton.toolTip = "<p>The script will select a star catalog automatically " +
      "based on the estimated field of view of the image.</p>";
   this.automaticCatalog_RadioButton.onCheck = function()
   {
      this.dialog.solverCfg.catalogMode = CatalogMode.prototype.Automatic;
      this.dialog.updateCatalogSelectionControls();
   };

   this.automaticCatalog_Sizer = new HorizontalSizer;
   this.automaticCatalog_Sizer.addUnscaledSpacing( labelWidth1 + this.logicalPixelsToPhysical( 4 ) );
   this.automaticCatalog_Sizer.add( this.automaticCatalog_RadioButton );
   this.automaticCatalog_Sizer.addStretch();

   //

   this.localXPSDCatalog_RadioButton = new RadioButton( this );
   this.localXPSDCatalog_RadioButton.text = "Local XPSD server:";
   this.localXPSDCatalog_RadioButton.textAlignment = TextAlign_Right | TextAlign_VertCenter;
   this.localXPSDCatalog_RadioButton.setMinWidth( labelWidth1 );
   this.localXPSDCatalog_RadioButton.checked = this.solverCfg.catalogMode == CatalogMode.prototype.LocalXPSDServer;
   this.localXPSDCatalog_RadioButton.toolTip = "<p>Use a local XPSD catalog server.</p>" +
      "<p>The script supports local database files in XPSD (eXtensible Point Source Database) format.</p>";
   this.localXPSDCatalog_RadioButton.onCheck = function()
   {
      this.dialog.solverCfg.catalogMode = CatalogMode.prototype.LocalXPSDServer;
      this.dialog.localXPSDCatalog_ComboBox.onItemSelected();
      this.dialog.updateCatalogSelectionControls();
   };

   this.localXPSDCatalogButton_Sizer = new HorizontalSizer;
   this.localXPSDCatalogButton_Sizer.addUnscaledSpacing( labelWidth1 + this.logicalPixelsToPhysical( 4 ) );
   this.localXPSDCatalogButton_Sizer.add( this.localXPSDCatalog_RadioButton );
   this.localXPSDCatalogButton_Sizer.addStretch();

   //

   this.localXPSDCatalog_ComboBox = new ComboBox( this );
   let toolTip = "<p>Available XPSD servers:</p><ul>";
   for ( let i = 0; i < this.solverCfg.availableXPSDServers.length; ++i )
   {
      this.localXPSDCatalog_ComboBox.addItem( this.solverCfg.availableXPSDServers[i].name );
      if ( this.solverCfg.availableXPSDServers[i].id == this.solverCfg.catalog )
         this.localXPSDCatalog_ComboBox.currentItem = i;
      toolTip += "<li>" + this.solverCfg.availableXPSDServers[i].description + "</li>";
   }
   toolTip += "</ul>";
   this.localXPSDCatalog_ComboBox.editEnabled = false;
   this.localXPSDCatalog_ComboBox.toolTip = toolTip;
   this.localXPSDCatalog_ComboBox.onItemSelected = function()
   {
      this.dialog.solverCfg.catalog = this.dialog.solverCfg.availableXPSDServers[
         this.dialog.localXPSDCatalog_ComboBox.currentItem ].id;
   };

   //

   this.localXPSDCatalog_Sizer = new HorizontalSizer;
   this.localXPSDCatalog_Sizer.spacing = 4;
   this.localXPSDCatalog_Sizer.addUnscaledSpacing( labelWidth1 + this.logicalPixelsToPhysical( 4 ) );
   this.localXPSDCatalog_Sizer.add( this.localXPSDCatalog_ComboBox );
   this.localXPSDCatalog_Sizer.addStretch();

   //

   this.localStarCatalog_RadioButton = new RadioButton( this );
   this.localStarCatalog_RadioButton.text = "Local star catalog:";
   this.localStarCatalog_RadioButton.textAlignment = TextAlign_Right | TextAlign_VertCenter;
   this.localStarCatalog_RadioButton.setMinWidth( labelWidth1 );
   this.localStarCatalog_RadioButton.checked = this.solverCfg.catalogMode == CatalogMode.prototype.LocalText;
   this.localStarCatalog_RadioButton.toolTip = "<p>Use a locally stored star catalog.</p>" +
      "<p>The script supports custom text files that can be created with a spreadsheet, or be downloaded " +
      "from an online catalog server.</p>";
   this.localStarCatalog_RadioButton.onCheck = function()
   {
      this.dialog.solverCfg.catalogMode = CatalogMode.prototype.LocalText;
      this.dialog.updateCatalogSelectionControls();
   };

   this.localStarCatalogButton_Sizer = new HorizontalSizer;
   this.localStarCatalogButton_Sizer.addUnscaledSpacing( labelWidth1 + this.logicalPixelsToPhysical( 4 ) );
   this.localStarCatalogButton_Sizer.add( this.localStarCatalog_RadioButton );
   this.localStarCatalogButton_Sizer.addStretch();

   //

   this.localStarCatalog_Edit = new Edit( this );
   if ( this.solverCfg.databasePath )
      this.localStarCatalog_Edit.text = this.solverCfg.databasePath;
   this.localStarCatalog_Edit.setScaledMinWidth( 200 );
   this.localStarCatalog_Edit.toolTip = "<p>Path to a star database file in text format.</p>" +
      "<p>The text files can be downloaded from an online server using the download button.</p>";
   this.localStarCatalog_Edit.onTextUpdated = function( value )
   {
      this.dialog.solverCfg.databasePath = value;
   };

   this.localStarCatalogSelect_Button = new ToolButton( this );
   this.localStarCatalogSelect_Button.icon = this.scaledResource( ":/icons/select-file.png" );
   this.localStarCatalogSelect_Button.setScaledFixedSize( 24, 24 );
   this.localStarCatalogSelect_Button.toolTip = "<p>Select a catalog file.</p>";
   this.localStarCatalogSelect_Button.onClick = function()
   {
      let gdd = new OpenFileDialog;
      gdd.initialPath = this.dialog.localStarCatalog_Edit.text;
      gdd.caption = "Select Star Database Path";
      gdd.filters = [
         [ "All supported catalog files", "*.bin,*.txt" ],
         [ "Star database files", "*.bin" ],
         [ "Custom catalog files", "*.txt" ]
      ];
      if ( gdd.execute() )
      {
         this.dialog.solverCfg.databasePath = gdd.fileName;
         this.dialog.localStarCatalog_Edit.text = gdd.fileName;
      }
   };

   this.localStarCatalogDownload_Button = new ToolButton( this );
   this.localStarCatalogDownload_Button.icon = this.scaledResource( ":/icons/download.png" );
   this.localStarCatalogDownload_Button.setScaledFixedSize( 24, 24 );
   this.localStarCatalogDownload_Button.toolTip = "<p>Download from an online catalog.</p>";
   this.localStarCatalogDownload_Button.onClick = function()
   {
      let dlg = new CatalogDownloaderDialog( this.dialog.metadata, this.dialog.solverCfg.vizierServer );
      if ( dlg.execute() )
      {
         this.dialog.localStarCatalog_Edit.text = dlg.path;
         this.dialog.solverCfg.databasePath = dlg.path;
      }
   };

   this.localStarCatalog_Sizer = new HorizontalSizer;
   this.localStarCatalog_Sizer.spacing = 4;
   this.localStarCatalog_Sizer.addUnscaledSpacing( labelWidth1 + this.logicalPixelsToPhysical( 4 ) );
   this.localStarCatalog_Sizer.add( this.localStarCatalog_Edit, 100 );
   this.localStarCatalog_Sizer.add( this.localStarCatalogSelect_Button );
   this.localStarCatalog_Sizer.add( this.localStarCatalogDownload_Button );

   //

   this.onlineStarCatalog_RadioButton = new RadioButton( this );
   this.onlineStarCatalog_RadioButton.text = "Online star catalog:";
   this.onlineStarCatalog_RadioButton.textAlignment = TextAlign_Right | TextAlign_VertCenter;
   this.onlineStarCatalog_RadioButton.setMinWidth( labelWidth1 );
   this.onlineStarCatalog_RadioButton.checked = this.solverCfg.catalogMode == CatalogMode.prototype.Online;
   this.onlineStarCatalog_RadioButton.toolTip = "Use an online VizieR catalog server";
   this.onlineStarCatalog_RadioButton.onCheck = function( value )
   {
      this.dialog.solverCfg.catalogMode = CatalogMode.prototype.Online;
      this.dialog.updateCatalogSelectionControls();
   }

   this.onlineStarCatalogButton_Sizer = new HorizontalSizer;
   this.onlineStarCatalogButton_Sizer.addUnscaledSpacing( labelWidth1 + this.logicalPixelsToPhysical( 4 ) );
   this.onlineStarCatalogButton_Sizer.add( this.onlineStarCatalog_RadioButton );
   this.onlineStarCatalogButton_Sizer.addStretch();

   //

   this.onlineStarCatalog_ComboBox = new ComboBox( this );
   let toolTip = "<p>Available catalogs:</p><ul>";
   for ( let i = 0; i < this.solverCfg.availableCatalogs.length; ++i )
   {
      this.onlineStarCatalog_ComboBox.addItem( this.solverCfg.availableCatalogs[i].name );
      if ( this.solverCfg.availableCatalogs[i].name == this.solverCfg.catalog )
         this.onlineStarCatalog_ComboBox.currentItem = i;
      toolTip += "<li>" + this.solverCfg.availableCatalogs[i].description + "</li>";
   }
   toolTip += "</ul>";
   this.onlineStarCatalog_ComboBox.editEnabled = false;
   this.onlineStarCatalog_ComboBox.setFixedWidth( this.font.width( "Bright StarsMMMMMM" ) );
   this.onlineStarCatalog_ComboBox.toolTip = toolTip;
   this.onlineStarCatalog_ComboBox.onItemSelected = function()
   {
      this.dialog.solverCfg.catalog =
         this.dialog.solverCfg.availableCatalogs[ this.dialog.onlineStarCatalog_ComboBox.currentItem ].name;
   };

   this.onlineStarCatalogSelect_Button = new ToolButton( this );
   this.onlineStarCatalogSelect_Button.icon = this.scaledResource( ":/icons/network-database.png" );
   this.onlineStarCatalogSelect_Button.setScaledFixedSize( 24, 24 );
   this.onlineStarCatalogSelect_Button.toolTip = "<p>Select the best VizieR server for your location.</p>";
   this.onlineStarCatalogSelect_Button.onClick = function()
   {
      let dlg = new VizierMirrorDialog( this.dialog.solverCfg.vizierServer );
      if ( dlg.execute() )
         this.dialog.solverCfg.vizierServer = dlg.server;
   };

   this.onlineStarCatalogTerms_Button = new ToolButton( this );
   this.onlineStarCatalogTerms_Button.text = "Terms of use of VizieR data";
   this.terms_Font = new Font( this.font.family, 6.5 );
   this.terms_Font.underline = true;
   this.onlineStarCatalogTerms_Button.font = this.terms_Font;
   this.onlineStarCatalogTerms_Button.onClick = function()
   {
      Dialog.openBrowser( "https://cds.unistra.fr/vizier-org/licences_vizier.html" );
   };

   this.onlineStarCatalog_Sizer = new HorizontalSizer;
   this.onlineStarCatalog_Sizer.spacing = 4;
   this.onlineStarCatalog_Sizer.addUnscaledSpacing( labelWidth1 + this.logicalPixelsToPhysical( 4 ) );
   this.onlineStarCatalog_Sizer.add( this.onlineStarCatalog_ComboBox );
   //this.onlineStarCatalog_Sizer.add( this.mirror_Combo );
   this.onlineStarCatalog_Sizer.add( this.onlineStarCatalogSelect_Button );
   this.onlineStarCatalog_Sizer.addStretch();
   this.onlineStarCatalog_Sizer.add( this.onlineStarCatalogTerms_Button );

   //

   this.limitMagnitude_Control = new NumericControl( this );
   this.limitMagnitude_Control.real = true;
   this.limitMagnitude_Control.label.text = "Limit magnitude:";
   this.limitMagnitude_Control.label.minWidth = labelWidth1;
   this.limitMagnitude_Control.setRange( 0, 30 );
   this.limitMagnitude_Control.slider.setRange( 0, 300 );
   this.limitMagnitude_Control.slider.minWidth = 250;
   this.limitMagnitude_Control.setPrecision( 2 );
   this.limitMagnitude_Control.enableFixedPrecision( true );
   this.limitMagnitude_Control.edit.minWidth = spinBoxWidth;
   this.limitMagnitude_Control.setValue( this.solverCfg.magnitude );
   this.limitMagnitude_Control.toolTip = "<p>Maximum star magnitude to use for the image " +
      "registration and plate-solving algorithms.</p>" +
      "<p>For wider fields, use lower limit magnitude values.</p>";
   this.limitMagnitude_Control.enabled = !this.solverCfg.autoMagnitude;
   this.limitMagnitude_Control.onValueUpdated = function( value )
   {
      this.dialog.solverCfg.magnitude = value;
   };

   //

   this.automaticLimitMagnitude_CheckBox = new CheckBox( this );
   this.automaticLimitMagnitude_CheckBox.text = "Automatic limit magnitude";
   this.automaticLimitMagnitude_CheckBox.toolTip = "<p>The script selects the optimal " +
      "limit magnitude automatically based on the estimated field of view of the image.</p>";
   this.automaticLimitMagnitude_CheckBox.checked = this.solverCfg.autoMagnitude;
   this.automaticLimitMagnitude_CheckBox.onCheck = function( checked )
   {
      this.dialog.solverCfg.autoMagnitude = checked;
      this.dialog.limitMagnitude_Control.enabled = !checked;
   };

   this.automaticLimitMagnitude_Sizer = new HorizontalSizer;
   this.automaticLimitMagnitude_Sizer.addUnscaledSpacing( labelWidth1 + this.logicalPixelsToPhysical( 4 ) );
   this.automaticLimitMagnitude_Sizer.add( this.automaticLimitMagnitude_CheckBox );
   this.automaticLimitMagnitude_Sizer.addStretch();

   //

   this.modelParameters_Control = new Control( this )

   this.modelParameters_Control.sizer = new VerticalSizer;
   this.modelParameters_Control.sizer.margin = 6;
   this.modelParameters_Control.sizer.spacing = 4;
   this.modelParameters_Control.sizer.add( this.referenceSystem_Sizer );
   this.modelParameters_Control.sizer.add( this.automaticCatalog_Sizer );
   this.modelParameters_Control.sizer.add( this.localXPSDCatalogButton_Sizer );
   this.modelParameters_Control.sizer.add( this.localXPSDCatalog_Sizer );
   this.modelParameters_Control.sizer.add( this.localStarCatalogButton_Sizer );
   this.modelParameters_Control.sizer.add( this.localStarCatalog_Sizer );
   this.modelParameters_Control.sizer.add( this.onlineStarCatalogButton_Sizer );
   this.modelParameters_Control.sizer.add( this.onlineStarCatalog_Sizer );
   this.modelParameters_Control.sizer.add( this.limitMagnitude_Control );
   this.modelParameters_Control.sizer.add( this.automaticLimitMagnitude_Sizer );

   this.modelParameters_Section = new SectionBar( this, "Model Parameters" );
   this.modelParameters_Section.setSection( this.modelParameters_Control );
   this.modelParameters_Section.onToggleSection = toggleSectionHandler;

   // -------------------------------------------------------------------------
   // Advanced Parameters
   // -------------------------------------------------------------------------

   this.projection_Label = new fieldLabel( this, "Projection:", labelWidth1 );

   this.projection_ComboBox = new ComboBox( this );
   this.projection_ComboBox.editEnabled = false;
   this.projection_ComboBox.toolTip = "<p>Projection system used to represent coordinate transformations.</p>";
   this.projection_ComboBox.addItem( "Gnomonic" );
   this.projection_ComboBox.addItem( "Stereographic" );
   this.projection_ComboBox.addItem( "Plate-carrée" );
   this.projection_ComboBox.addItem( "Mercator" );
   this.projection_ComboBox.addItem( "Hammer-Aitoff" );
   this.projection_ComboBox.addItem( "Zenithal equal area" );
   this.projection_ComboBox.addItem( "Orthographic" );
   if ( this.solverCfg.projection != null )
      this.projection_ComboBox.currentItem = this.solverCfg.projection;
   this.projection_ComboBox.onItemSelected = function()
   {
      this.dialog.solverCfg.projection = this.currentItem;
      this.dialog.solverCfg.projectionOriginMode = 0;
   };

   this.projection_Button = new PushButton( this );
   this.projection_Button.text = "Advanced";
   this.projection_Button.onClick = function()
   {
      ( new ConfigProjectionDialog( this.dialog.solverCfg, this.dialog.solverCfg.projection ) ).execute();
   };

   this.projection_Sizer = new HorizontalSizer;
   this.projection_Sizer.spacing = 4;
   this.projection_Sizer.add( this.projection_Label );
   this.projection_Sizer.add( this.projection_ComboBox );
   this.projection_Sizer.add( this.projection_Button );
   this.projection_Sizer.addStretch();

   //

   this.detectionScales_Label = new fieldLabel( this, "Detection scales:", labelWidth1 );

   this.detectionScales_SpinBox = new SpinBox( this );
   this.detectionScales_SpinBox.minValue = 1;
   this.detectionScales_SpinBox.maxValue = 8;
   this.detectionScales_SpinBox.value = this.solverCfg.structureLayers;
   this.detectionScales_SpinBox.toolTip = "<p>Number of wavelet layers used for structure detection.</p>" +
      "<p>With more wavelet layers, larger stars (and perhaps also some nonstellar objects) will be detected.</p>";
   this.detectionScales_SpinBox.setFixedWidth( spinBoxWidth );
   this.detectionScales_SpinBox.onValueUpdated = function( value )
   {
      this.dialog.solverCfg.structureLayers = value;
   };

   this.detectionScales_Sizer = new HorizontalSizer;
   this.detectionScales_Sizer.spacing = 4;
   this.detectionScales_Sizer.add( this.detectionScales_Label );
   this.detectionScales_Sizer.add( this.detectionScales_SpinBox );
   this.detectionScales_Sizer.addStretch();

   //

   this.minStructureSize_Label = new fieldLabel( this, "Minimum structure size:", labelWidth1 );

   this.minStructureSize_SpinBox = new SpinBox( this );
   this.minStructureSize_SpinBox.minValue = 0;
   this.minStructureSize_SpinBox.maxValue = 256;
   this.minStructureSize_SpinBox.value = this.solverCfg.minStructureSize;
   this.minStructureSize_SpinBox.toolTip = "<p>Minimum size of a detectable star structure in square pixels.</p>" +
      "<p>This parameter can be used to prevent detection of small and bright image artifacts as stars. " +
      "This can be useful to work with uncalibrated or wrongly calibrated data, especially demosaiced CFA frames " +
      "where hot pixels have generated large bright artifacts that cannot be removed with a median filter " +
      "(i.e., the <i>Hot pixel removal</i> parameter).</p>" +
      "<p>Changing the default zero value of this parameter should not be necessary with correctly acquired and " +
      "calibrated data. It may help, however, when working with poor quality data such as poorly tracked, poorly focused, " +
      "wrongly calibrated, low-SNR raw frames, for which our image registration algorithms and tools have not been " +
      "designed specifically.</p>";
   this.minStructureSize_SpinBox.setFixedWidth( spinBoxWidth );
   this.minStructureSize_SpinBox.onValueUpdated = function( value )
   {
      this.dialog.solverCfg.minStructureSize = value;
   };

   this.minStructureSize_Sizer = new HorizontalSizer;
   this.minStructureSize_Sizer.spacing = 4;
   this.minStructureSize_Sizer.add( this.minStructureSize_Label );
   this.minStructureSize_Sizer.add( this.minStructureSize_SpinBox );
   this.minStructureSize_Sizer.addStretch();

   //

   this.hotPixelFilterRadius_Label = new fieldLabel( this, "Hot pixel removal:", labelWidth1 );

   this.hotPixelFilterRadius_SpinBox = new SpinBox( this );
   this.hotPixelFilterRadius_SpinBox.minValue = 0;
   this.hotPixelFilterRadius_SpinBox.maxValue = 2;
   this.hotPixelFilterRadius_SpinBox.value = this.solverCfg.hotPixelFilterRadius;
   this.hotPixelFilterRadius_SpinBox.toolTip = "<p>Size of the hot pixel removal filter.</p>" +
      "<p>This is the radius in pixels of a median filter applied by the star detector before the structure " +
      "detection phase. A median filter is very efficient to remove <i>hot pixels</i>. Hot pixels will be " +
      "identified as false stars, and if present in large amounts, can prevent a valid image registration.</p>" +
      "<p>To disable hot pixel removal, set this parameter to zero.</p>";
   this.hotPixelFilterRadius_SpinBox.setFixedWidth( spinBoxWidth );
   this.hotPixelFilterRadius_SpinBox.onValueUpdated = function( value )
   {
      this.dialog.solverCfg.hotPixelFilterRadius = value;
   };

   this.hotPixelFilterRadius_Sizer = new HorizontalSizer;
   this.hotPixelFilterRadius_Sizer.spacing = 4;
   this.hotPixelFilterRadius_Sizer.add( this.hotPixelFilterRadius_Label );
   this.hotPixelFilterRadius_Sizer.add( this.hotPixelFilterRadius_SpinBox );
   this.hotPixelFilterRadius_Sizer.addStretch();

   //

   this.noiseReductionFilterRadius_Label = new fieldLabel( this, "Noise reduction:", labelWidth1 );

   this.noiseReductionFilterRadius_SpinBox = new SpinBox( this );
   this.noiseReductionFilterRadius_SpinBox.minValue = 0;
   this.noiseReductionFilterRadius_SpinBox.maxValue = 50;
   this.noiseReductionFilterRadius_SpinBox.value = this.solverCfg.noiseReductionFilterRadius;
   this.noiseReductionFilterRadius_SpinBox.toolTip = "<p>Size of the noise reduction filter.</p>" +
      "<p>This is the radius in pixels of a Gaussian convolution filter applied to the working image used for " +
      "calculation of star positions during the star detection phase. Use it only for very low SNR images, where " +
      "the star detector cannot find reliable stars with default parameters.</p>" +
      "<p>Be aware that noise reduction will modify star profiles and hence the way star positions are calculated, " +
      "resulting in a less accurate image registration. Under extreme low-SNR conditions, however, this is probably " +
      "better than working with the actual data anyway.</p>" +
      "<p>To disable noise reduction, set this parameter to zero.</p>";

   this.noiseReductionFilterRadius_SpinBox.setFixedWidth( spinBoxWidth );
   this.noiseReductionFilterRadius_SpinBox.onValueUpdated = function( value )
   {
      this.dialog.solverCfg.noiseReductionFilterRadius = value;
   };

   this.noiseReductionFilterRadius_Sizer = new HorizontalSizer;
   this.noiseReductionFilterRadius_Sizer.spacing = 4;
   this.noiseReductionFilterRadius_Sizer.add( this.noiseReductionFilterRadius_Label );
   this.noiseReductionFilterRadius_Sizer.add( this.noiseReductionFilterRadius_SpinBox );
   this.noiseReductionFilterRadius_Sizer.addStretch();

   //

   this.starSensitivity_Control = new NumericControl( this );
   this.starSensitivity_Control.real = true;
   this.starSensitivity_Control.label.text = "Sensitivity:";
   this.starSensitivity_Control.label.minWidth = labelWidth1;
   this.starSensitivity_Control.setRange( 0, 1 );
   this.starSensitivity_Control.slider.setRange( 0, 100 );
   this.starSensitivity_Control.slider.minWidth = 250;
   this.starSensitivity_Control.setPrecision( 2 );
   this.starSensitivity_Control.edit.minWidth = spinBoxWidth;
   this.starSensitivity_Control.setValue( this.solverCfg.sensitivity );
   this.starSensitivity_Control.toolTip = "<p>Star detection sensitivity.</p>" +
      "<p>Internally, the sensitivity of the star detection algorithm is expressed in signal-to-noise ratio units with " +
      "respect to the evaluated dispersion of local background pixels for each detected structure. Given a source with " +
      "estimated brightness <i>s</i>, local background <i>b</i> and local background dispersion <i>n</i>, sensitivity " +
      "is the minimum value of (<i>s</i> - <i>b</i>)/<i>n</i> necessary to trigger star detection.</p>" +
      "<p>To isolate this interface from the internal implementation, this parameter is normalized to the [0,1] range, " +
      "where 0 and 1 represent minimum and maximum sensitivity, respectively. This abstraction allows us to change the " +
      "star detection engine without breaking dependent tools and processes.</p>" +
      "<p>Increase this parameter to favor detection of fainter stars. Decrease it to restrict detection to brighter " +
      "stars. The default value is 0.5. In general, you shouldn't need to change the default value of this parameter " +
      "under normal working conditions.</p>";
   this.starSensitivity_Control.onValueUpdated = function( value )
   {
      this.dialog.solverCfg.sensitivity = value;
   };

   //

   this.peakResponse_Control = new NumericControl( this );
   this.peakResponse_Control.real = true;
   this.peakResponse_Control.label.text = "Peak response:";
   this.peakResponse_Control.label.minWidth = labelWidth1;
   this.peakResponse_Control.setRange( 0, 1 );
   this.peakResponse_Control.slider.setRange( 0, 100 );
   this.peakResponse_Control.slider.minWidth = 250;
   this.peakResponse_Control.setPrecision( 2 );
   this.peakResponse_Control.edit.minWidth = spinBoxWidth;
   this.peakResponse_Control.setValue( this.solverCfg.peakResponse );
   this.peakResponse_Control.toolTip = "<p>Peak sensitivity of the star detection device.</p>" +
      "<p>Internally, the peak response property of the star detection algorithm is expressed in kurtosis units. For " +
      "each detected structure, kurtosis is evaluated from all significant pixels with values greater than the estimated " +
      "mean local background. Peak response is the minimum value of kurtosis necessary to trigger star detection.</p>" +
      "<p>To isolate this interface from the internal implementation, this parameter is normalized to the [0,1] range, " +
      "where 0 and 1 represent minimum and maximum peak response, respectively. This abstraction allows us to change the " +
      "star detection engine without breaking dependent tools and processes.</p>" +
      "<p>If you decrease this parameter, stars will need to have stronger (or more prominent) peaks to be detected. This " +
      "is useful to prevent detection of saturated stars, as well as small nonstellar features. By increasing this " +
      "parameter, the star detection algorithm will be more sensitive to <i>peakedness</i>, and hence more tolerant with " +
      "relatively flat image features. The default value is 0.5. In general, you shouldn't need to change the default " +
      "value of this parameter under normal working conditions.</p>";
   this.peakResponse_Control.onValueUpdated = function( value )
   {
      this.dialog.solverCfg.peakResponse = value;
   };

   //

   this.brightThreshold_Control = new NumericControl( this );
   this.brightThreshold_Control.real = true;
   this.brightThreshold_Control.label.text = "Bright threshold:";
   this.brightThreshold_Control.label.minWidth = labelWidth1;
   this.brightThreshold_Control.setRange( 1, 100 );
   this.brightThreshold_Control.slider.setRange( 1, 100 );
   this.brightThreshold_Control.slider.minWidth = 250;
   this.brightThreshold_Control.setPrecision( 2 );
   this.brightThreshold_Control.edit.minWidth = spinBoxWidth;
   this.brightThreshold_Control.setValue( this.solverCfg.brightThreshold );
   this.brightThreshold_Control.toolTip = "<p>Bright star detection threshold</p>" +
      "<p>Sources with measured SNR above this parameter in units of the minimum detection level (as defined by the " +
      "sensitivity parameter) will always be detected, even if their profiles are too flat for the current peak response. " +
      "This parameter allows us to force inclusion of relatively bright stars irrespective of their shapes, and also " +
      "provides finer control on the amount of detectable stars, along with the sensitivity parameter. The default value " +
      "is 3.0.</p>";
   this.brightThreshold_Control.onValueUpdated = function( value )
   {
      this.dialog.solverCfg.brightThreshold = value;
   };

   //

   this.maxStarDistortion_Control = new NumericControl( this );
   this.maxStarDistortion_Control.real = true;
   this.maxStarDistortion_Control.label.text = "Maximum distortion:";
   this.maxStarDistortion_Control.label.minWidth = labelWidth1;
   this.maxStarDistortion_Control.setRange( 0, 1 );
   this.maxStarDistortion_Control.slider.setRange( 0, 100 );
   this.maxStarDistortion_Control.slider.minWidth = 250;
   this.maxStarDistortion_Control.setPrecision( 2 );
   this.maxStarDistortion_Control.edit.minWidth = spinBoxWidth;
   this.maxStarDistortion_Control.setValue( this.solverCfg.maxStarDistortion );
   this.maxStarDistortion_Control.toolTip = "<p>Maximum star distortion.</p>" +
      "<p>Internally, star distortion is evaluated in units of coverage of a square region circumscribed to each detected " +
      "structure. The coverage of a perfectly circular star is &pi;/4 (about 0.8). Lower values denote elongated or " +
      "irregular sources.</p>" +
      "<p>To isolate this interface from the internal implementation, this parameter is normalized to the [0,1] range, " +
      "where 0 and 1 represent minimum and maximum distortion, respectively. This abstraction allows us to change the " +
      "star detection engine without breaking dependent tools and processes.</p>" +
      "<p>Use this parameter, if necessary, to control inclusion of elongated stars, complex clusters of stars, and " +
      "nonstellar image features. The default value is 0.6. In general, you shouldn't need to change the default value of " +
      "this parameter under normal working conditions.</p>";
   this.maxStarDistortion_Control.onValueUpdated = function( value )
   {
      this.dialog.solverCfg.maxStarDistortion = value;
   };

   //

   this.autoPSF_CheckBox = new CheckBox( this );
   this.autoPSF_CheckBox.text = "Automatic PSF model";
   this.autoPSF_CheckBox.checked = this.solverCfg.autoPSF;
   this.autoPSF_CheckBox.toolTip = "<p>When this option is enabled, multiple PSF models, including Gaussian and several " +
      "Moffat functions, will be fitted for each star. The function that best matches the actual image data will be selected. " +
      "This optimizes PSF fitting adaptively to find the most accurate centroid coordinates for each detected source, but at " +
      "the cost of a much higher computation time. When this option is disabled only Gaussian PSFs will be fitted.</p>" +
      "<p>This option is disabled by default. It can be enabled to achieve the highest possible accuracy in the computed " +
      "astrometric solution with distortion corrections, although the improvements are usually very small, and often marginal.</p>";
   this.autoPSF_CheckBox.onCheck = function( checked )
   {
      this.dialog.solverCfg.autoPSF = checked;
   };

   this.autoPSF_Sizer = new HorizontalSizer;
   this.autoPSF_Sizer.addUnscaledSpacing( labelWidth1 + this.logicalPixelsToPhysical( 4 ) );
   this.autoPSF_Sizer.add( this.autoPSF_CheckBox );
   this.autoPSF_Sizer.addStretch();

   //

   this.restrictToHQStars_CheckBox = new CheckBox( this );
   this.restrictToHQStars_CheckBox.text = "Restrict to high-quality stars";
   this.restrictToHQStars_CheckBox.checked = this.solverCfg.restrictToHQStars;
   this.restrictToHQStars_CheckBox.toolTip = "<p>When checked, the astrometric solution will use exclusively stars for " +
      "which high-quality positions and proper motions are available. This option is only used with local XPSD server " +
      "catalogs (currently Gaia DR2, EDR3 and DR3). This option is always ignored for online catalogs.</p>";
   this.restrictToHQStars_CheckBox.onCheck = function( checked )
   {
      this.dialog.solverCfg.restrictToHQStars = checked;
   };

   this.restrictToHQStars_Sizer = new HorizontalSizer;
   this.restrictToHQStars_Sizer.addUnscaledSpacing( labelWidth1 + this.logicalPixelsToPhysical( 4 ) );
   this.restrictToHQStars_Sizer.add( this.restrictToHQStars_CheckBox );
   this.restrictToHQStars_Sizer.addStretch();

   //

   this.optimizeSol_CheckBox = new CheckBox( this );
   this.optimizeSol_CheckBox.text = "Optimize the solution";
   this.optimizeSol_CheckBox.checked = this.solverCfg.optimizeSolution;
   this.optimizeSol_CheckBox.enabled = !this.solverCfg.onlyOptimize;
   this.optimizeSol_CheckBox.toolTip = "<p>When checked, the astrometric solution is optimized using " +
      "accurate star positions calculated using the DynamicPSF process.</p>" +
      "<p>When the image has been heavily processed and/or stretched the PSF extraction could fail, " +
      "so the result could be worse than before the optimization.</p>";
   this.optimizeSol_CheckBox.onCheck = function( checked )
   {
      this.dialog.solverCfg.optimizeSolution = checked;
   };

   this.optimizeSol_Sizer = new HorizontalSizer;
   this.optimizeSol_Sizer.addUnscaledSpacing( labelWidth1 + this.logicalPixelsToPhysical( 4 ) );
   this.optimizeSol_Sizer.add( this.optimizeSol_CheckBox );
   this.optimizeSol_Sizer.addStretch();

   //

   this.showStars_CheckBox = new CheckBox( this );
   this.showStars_CheckBox.text = "Show stars";
   this.showStars_CheckBox.checked = this.solverCfg.showStars;
   this.showStars_CheckBox.toolTip = "<p>When checked, generates a new image with corss marks at the " +
      "positions of the detected stars in the original image.</p>" +
      "<p>These control images are useful to compare the results of different values of the detection " +
      "sensitivity parameter.</p>";
   this.showStars_CheckBox.onCheck = function( checked )
   {
      this.dialog.solverCfg.showStars = checked;
   };

   this.showStars_Sizer = new HorizontalSizer;
   this.showStars_Sizer.addUnscaledSpacing( labelWidth1 + this.logicalPixelsToPhysical( 4 ) );
   this.showStars_Sizer.add( this.showStars_CheckBox );
   this.showStars_Sizer.addStretch();

   //

   this.generateResidualsImage_CheckBox = new CheckBox( this );
   this.generateResidualsImage_CheckBox.text = "Generate residuals image";
   this.generateResidualsImage_CheckBox.checked = this.solverCfg.generateErrorImg != null && this.solverCfg.generateErrorImg;
   this.generateResidualsImage_CheckBox.toolTip = "<p>Generates an image with the predicted star positions " +
      "(green checkmarks) and arrows (red lines) pointing to the actual measured positions on the image.</p>" +
      "<p>These control images can be used to analyze the errors of the computed solutions.</p>";
   this.generateResidualsImage_CheckBox.onCheck = function( checked )
   {
      this.dialog.solverCfg.generateErrorImg = checked;
   };

   this.generateResidualsImage_Sizer = new HorizontalSizer;
   this.generateResidualsImage_Sizer.addUnscaledSpacing( labelWidth1 + this.logicalPixelsToPhysical( 4 ) );
   this.generateResidualsImage_Sizer.add( this.generateResidualsImage_CheckBox );
   this.generateResidualsImage_Sizer.addStretch();

   //

   this.advancedParameters_Control = new Control( this );
   this.advancedParameters_Control.hide();

   this.advancedParameters_Control.sizer = new VerticalSizer;
   this.advancedParameters_Control.sizer.margin = 6;
   this.advancedParameters_Control.sizer.spacing = 4;
   this.advancedParameters_Control.sizer.add( this.projection_Sizer );
   this.advancedParameters_Control.sizer.add( this.detectionScales_Sizer );
   this.advancedParameters_Control.sizer.add( this.minStructureSize_Sizer );
   this.advancedParameters_Control.sizer.add( this.hotPixelFilterRadius_Sizer );
   this.advancedParameters_Control.sizer.add( this.noiseReductionFilterRadius_Sizer );
   this.advancedParameters_Control.sizer.add( this.starSensitivity_Control );
   this.advancedParameters_Control.sizer.add( this.peakResponse_Control );
   this.advancedParameters_Control.sizer.add( this.brightThreshold_Control );
   this.advancedParameters_Control.sizer.add( this.maxStarDistortion_Control );
   this.advancedParameters_Control.sizer.add( this.autoPSF_Sizer );
   this.advancedParameters_Control.sizer.add( this.restrictToHQStars_Sizer );
   this.advancedParameters_Control.sizer.add( this.optimizeSol_Sizer );
   this.advancedParameters_Control.sizer.add( this.showStars_Sizer );
   this.advancedParameters_Control.sizer.add( this.generateResidualsImage_Sizer );

   this.advancedParameters_Section = new SectionBar( this, "Advanced Parameters" );
   this.advancedParameters_Section.setSection( this.advancedParameters_Control );
   this.advancedParameters_Section.onToggleSection = toggleSectionHandler;

   // -------------------------------------------------------------------------
   // Distortion Correction
   // -------------------------------------------------------------------------

   this.distortedCorners_CheckBox = new CheckBox( this );
   this.distortedCorners_CheckBox.text = "Advanced alignment";
   this.distortedCorners_CheckBox.checked = this.solverCfg.distortedCorners;
   this.distortedCorners_CheckBox.toolTip = "<p>This option splits the image in nine cells and calculates the " +
      "distortion independently for each one.</p><p>This algorithm is slower but works much better when the " +
      "corners of the image are very distorted. This is usually the case for images taken with consumer short " +
      "focal lenses.</p>";
   this.distortedCorners_CheckBox.onCheck = function( checked )
   {
      this.dialog.solverCfg.distortedCorners = checked;
   };
   this.distortedCorners_CheckBox.enabled = this.solverCfg.catalogMode != CatalogMode.prototype.LocalText;

   this.distortedCorners_Sizer = new HorizontalSizer;
   this.distortedCorners_Sizer.addUnscaledSpacing( labelWidth1 + this.logicalPixelsToPhysical( 4 ) );
   this.distortedCorners_Sizer.add( this.distortedCorners_CheckBox );
   this.distortedCorners_Sizer.addStretch();

   //

   this.splineOrder_Label = new fieldLabel( this, "Spline order:", labelWidth1 );

   this.splineOrder_SpinBox = new SpinBox( this );
   this.splineOrder_SpinBox.minValue = 2;
   this.splineOrder_SpinBox.maxValue = 6;
   this.splineOrder_SpinBox.value = this.solverCfg.splineOrder;
   this.splineOrder_SpinBox.toolTip = "<p>Derivative order of continuity of two-dimensional surface splines.</p>" +
      "<p>Second order surface splines, also known as <i>thin plate splines</i>, provide extremely adaptable " +
      "numerical models for images affected by strong distortions.</p>" +
      "<p>The rest of the options apply surface splines of orders 3, 4, 5, and 6. High-order surface splines " +
      "compute interpolation/regularization functions that are continuously differentiable up to the specified " +
      "order and hence can more accurately model complex distortions. However, high-order splines, especially " +
      "of orders above 4, are numerically more unstable and can lead to errors caused by ill-conditioned linear " +
      "systems.</p>" +
      "<p><b>The recommended options are:</b></p>" +
      "<ul>" +
      "<li>Thin plate splines (order 2) for distortion correction under normal conditions. This is the default option.<br/></li>" +
      "<li>3rd or 4th order surface splines for correction of complex distortions with maximum accuracy.</li>" +
      "</ul>";
   this.splineOrder_SpinBox.setFixedWidth( spinBoxWidth );
   this.splineOrder_SpinBox.onValueUpdated = function( value )
   {
      this.dialog.solverCfg.splineOrder = value;
   };

   this.splineOrder_Sizer = new HorizontalSizer;
   this.splineOrder_Sizer.spacing = 4;
   this.splineOrder_Sizer.add( this.splineOrder_Label );
   this.splineOrder_Sizer.add( this.splineOrder_SpinBox );
   this.splineOrder_Sizer.addStretch();

   //

   this.splineSmoothing_Control = new NumericControl( this );
   this.splineSmoothing_Control.real = true;
   this.splineSmoothing_Control.label.text = "Spline smoothing:";
   this.splineSmoothing_Control.label.minWidth = labelWidth1;
   this.splineSmoothing_Control.setRange( 0, 0.5 );
   this.splineSmoothing_Control.slider.setRange( 0, 1000 );
   this.splineSmoothing_Control.slider.minWidth = 250;
   this.splineSmoothing_Control.setPrecision( 3 );
   this.splineSmoothing_Control.edit.minWidth = spinBoxWidth;
   this.splineSmoothing_Control.setValue( this.solverCfg.splineSmoothing );
   this.splineSmoothing_Control.toolTip = "<p>When this parameter is greater than zero, " +
      "approximating surface splines will be generated instead of interpolating splines. " +
      "The higher this value, the closest will be the 2-D approximating surface to the " +
      "reference plane of the image. Approximating surface splines are robust to spurious " +
      "variations due to noise in control point positions and hence recommended in virtually " +
      "all cases. The default value is 0.010 pixels.</p>";
   this.splineSmoothing_Control.onValueUpdated = function( value )
   {
      this.dialog.solverCfg.splineSmoothing = value;
   };

   //

   this.enableSimplifier_CheckBox = new CheckBox( this );
   this.enableSimplifier_CheckBox.text = "Use surface simplifiers";
   this.enableSimplifier_CheckBox.checked = this.solverCfg.enableSimplifier;
   this.enableSimplifier_CheckBox.toolTip = "<p>If enabled, a surface simplification " +
      "algorithm will be applied to the lists of control points for surface spline generation. " +
      "The use of surface simplification greatly improves efficiency of surface splines by " +
      "removing all redundant points and keeping only the control points required to define " +
      "the coordinate transformations accurately. In addition, the applied surface simplification " +
      "algorithm implements robust PCA fitting and outlier rejection techniques that improve the " +
      "generated interpolation devices in terms of resilience to noise and invalid data in the " +
      "underlying astrometric solution. This option should normally be enabled.</p>";
   this.enableSimplifier_CheckBox.onCheck = function( checked )
   {
      this.dialog.solverCfg.enableSimplifier = checked;
      this.dialog.simplifierRejectFraction_Control.enabled = checked;
      this.dialog.showSimplifiedSurfaces_CheckBox.enabled = checked;
   };

   this.enableSimplifier_Sizer = new HorizontalSizer;
   this.enableSimplifier_Sizer.addUnscaledSpacing( labelWidth1 + this.logicalPixelsToPhysical( 4 ) );
   this.enableSimplifier_Sizer.add( this.enableSimplifier_CheckBox );
   this.enableSimplifier_Sizer.addStretch();

   //

   this.simplifierRejectFraction_Control = new NumericControl( this );
   this.simplifierRejectFraction_Control.real = true;
   this.simplifierRejectFraction_Control.label.text = "Simplifier rejection:";
   this.simplifierRejectFraction_Control.label.minWidth = labelWidth1;
   this.simplifierRejectFraction_Control.setRange( 0, 0.5 );
   this.simplifierRejectFraction_Control.slider.setRange( 0, 500 );
   this.simplifierRejectFraction_Control.slider.minWidth = 250;
   this.simplifierRejectFraction_Control.setPrecision( 2 );
   this.simplifierRejectFraction_Control.edit.minWidth = spinBoxWidth;
   this.simplifierRejectFraction_Control.setValue( this.solverCfg.simplifierRejectFraction );
   this.simplifierRejectFraction_Control.enabled = this.solverCfg.enableSimplifier;
   this.simplifierRejectFraction_Control.toolTip = "<p>Fraction of rejected control points for " +
      "simplification of surface subregions. The default value is 0.10.</p>";
   this.simplifierRejectFraction_Control.onValueUpdated = function( value )
   {
      this.dialog.solverCfg.simplifierRejectFraction = value;
   };

   //

   this.showSimplifiedSurfaces_CheckBox = new CheckBox( this );
   this.showSimplifiedSurfaces_CheckBox.text = "Show simplified surfaces";
   this.showSimplifiedSurfaces_CheckBox.checked = this.solverCfg.showSimplifiedSurfaces;
   this.showSimplifiedSurfaces_CheckBox.enabled = this.solverCfg.enableSimplifier;
   this.showSimplifiedSurfaces_CheckBox.toolTip = "<p>This option generates an image with " +
      "cross marks on simplified surface control points. These control images are useful " +
      "to evaluate the suitability of surface simplification parameters to model image distortions.</p>";
   this.showSimplifiedSurfaces_CheckBox.onCheck = function( checked )
   {
      this.dialog.solverCfg.showSimplifiedSurfaces = checked;
   };

   this.showSimplifiedSurfaces_Sizer = new HorizontalSizer;
   this.showSimplifiedSurfaces_Sizer.addUnscaledSpacing( labelWidth1 + this.logicalPixelsToPhysical( 4 ) );
   this.showSimplifiedSurfaces_Sizer.add( this.showSimplifiedSurfaces_CheckBox );
   this.showSimplifiedSurfaces_Sizer.addStretch();

   //

   this.showDistortionMap_CheckBox = new CheckBox( this );
   this.showDistortionMap_CheckBox.text = "Show distortion map";
   this.showDistortionMap_CheckBox.checked = this.solverCfg.showDistortion != null && this.solverCfg.showDistortion;
   this.showDistortionMap_CheckBox.toolTip = "<p>This option generates an image that shows the " +
      "distortion map of the image. It plots the difference between the final spline-based " +
      "solution and a linear solution.</p>";
   this.showDistortionMap_CheckBox.onCheck = function( checked )
   {
      this.dialog.solverCfg.showDistortion = checked;
   };

   this.showDistortionMap_Sizer = new HorizontalSizer;
   this.showDistortionMap_Sizer.addUnscaledSpacing( labelWidth1 + this.logicalPixelsToPhysical( 4 ) );
   this.showDistortionMap_Sizer.add( this.showDistortionMap_CheckBox );
   this.showDistortionMap_Sizer.addStretch();

   //

   let distortionModelToolTip = "<p>When a distortion model is selected, the solver uses it " +
      "as a model of the local distortions in the image. This model uses the same format as " +
      "the StarAlignment tool and can be generated using the ManualImageSolver or ImageSolver " +
      "scripts. The model should be generated using an image acquired with the same camera and " +
      "lenses, at the same focal and aperture.</p>";

   this.useDistortionModel_CheckBox = new CheckBox( this );
   this.useDistortionModel_CheckBox.text = "Use distortion model:";
   this.useDistortionModel_CheckBox.checked = this.solverCfg.useDistortionModel;
   this.useDistortionModel_CheckBox.toolTip = distortionModelToolTip;
   this.useDistortionModel_CheckBox.onCheck = function( checked )
   {
      this.dialog.solverCfg.useDistortionModel = checked;
      this.dialog.distortionModel_Edit.enabled = checked;
   };

   this.useDistortionModel_Sizer = new HorizontalSizer;
   this.useDistortionModel_Sizer.addUnscaledSpacing( labelWidth1 + this.logicalPixelsToPhysical( 4 ) );
   this.useDistortionModel_Sizer.add( this.useDistortionModel_CheckBox );
   this.useDistortionModel_Sizer.addStretch();

   //

   this.distortionModel_Edit = new Edit( this );
   if ( this.solverCfg.distortionModelPath )
      this.distortionModel_Edit.text = this.solverCfg.distortionModelPath;
   this.distortionModel_Edit.setScaledMinWidth( 200 );
   this.distortionModel_Edit.enabled = this.solverCfg.useDistortionModel;
   this.distortionModel_Edit.toolTip = distortionModelToolTip;
   this.distortionModel_Edit.onTextUpdated = function( value )
   {
      this.dialog.solverCfg.distortionModelPath = value;
   };

   this.distortionModelClear_Button = new ToolButton( this );
   this.distortionModelClear_Button.icon = this.scaledResource( ":/icons/clear.png" );
   this.distortionModelClear_Button.setScaledFixedSize( 24, 24 );
   this.distortionModelClear_Button.toolTip = "<p>Clear the distortion model file path.</p>";
   this.distortionModelClear_Button.onClick = function()
   {
      this.dialog.solverCfg.distortionModelPath = null;
      this.dialog.distortionModel_Edit.text = "";
   };

   this.distortionModelSelect_Button = new ToolButton( this );
   this.distortionModelSelect_Button.icon = this.scaledResource( ":/icons/select-file.png" );
   this.distortionModelSelect_Button.setScaledFixedSize( 24, 24 );
   this.distortionModelSelect_Button.toolTip = "<p>Select a distortion model file (CSV format).</p>";
   this.distortionModelSelect_Button.onClick = function()
   {
      let ofd = new OpenFileDialog;
      ofd.initialPath = this.dialog.distortionModel_Edit.text;
      ofd.caption = "Select Distortion Model";
      ofd.filters = [
         [ "Distortion models (*.csv)", "*.csv" ]
      ];
      if ( ofd.execute() )
      {
         this.dialog.solverCfg.distortionModelPath = ofd.fileName;
         this.dialog.distortionModel_Edit.text = ofd.fileName;
      }
   };

   this.distortionModel_Sizer = new HorizontalSizer;
   this.distortionModel_Sizer.spacing = 4;
   this.distortionModel_Sizer.addUnscaledSpacing( labelWidth1 + this.logicalPixelsToPhysical( 4 ) );
   this.distortionModel_Sizer.add( this.distortionModel_Edit, 100 );
   this.distortionModel_Sizer.add( this.distortionModelClear_Button );
   this.distortionModel_Sizer.add( this.distortionModelSelect_Button );

   //

   this.generateDistortionModel_CheckBox = new CheckBox( this );
   this.generateDistortionModel_CheckBox.text = "Generate distortion model";
   this.generateDistortionModel_CheckBox.checked = this.solverCfg.generateDistortModel != null && this.solverCfg.generateDistortModel;
   this.generateDistortionModel_CheckBox.toolTip = "<p>Generates a distortion model in CSV format, " +
      "compatible with the StarAlignment process.</p>";
   this.generateDistortionModel_CheckBox.onCheck = function( checked )
   {
      this.dialog.solverCfg.generateDistortModel = checked;
      this.dialog.useDistortionModel_CheckBox.checked = false;
   };

   this.generateDistortionModel_Sizer = new HorizontalSizer;
   this.generateDistortionModel_Sizer.addUnscaledSpacing( labelWidth1 + this.logicalPixelsToPhysical( 4 ) );
   this.generateDistortionModel_Sizer.add( this.generateDistortionModel_CheckBox );
   this.generateDistortionModel_Sizer.addStretch();

   //

   this.distortionCorrection_Control = new Control( this );
   this.distortionCorrection_Control.enabled = this.solverCfg.distortionCorrection;
   this.distortionCorrection_Control.hide();

   this.distortionCorrection_Control.sizer = new VerticalSizer;
   this.distortionCorrection_Control.sizer.margin = 6;
   this.distortionCorrection_Control.sizer.spacing = 4;
   this.distortionCorrection_Control.sizer.add( this.distortedCorners_Sizer );
   this.distortionCorrection_Control.sizer.add( this.splineOrder_Sizer );
   this.distortionCorrection_Control.sizer.add( this.splineSmoothing_Control );
   this.distortionCorrection_Control.sizer.add( this.enableSimplifier_Sizer );
   this.distortionCorrection_Control.sizer.add( this.simplifierRejectFraction_Control );
   this.distortionCorrection_Control.sizer.add( this.showSimplifiedSurfaces_Sizer );
   this.distortionCorrection_Control.sizer.add( this.showDistortionMap_Sizer );
   this.distortionCorrection_Control.sizer.add( this.useDistortionModel_Sizer );
   this.distortionCorrection_Control.sizer.add( this.distortionModel_Sizer );
   this.distortionCorrection_Control.sizer.add( this.generateDistortionModel_Sizer );

   this.distortionCorrection_Section = new SectionBar( this, "Distortion Correction" );
   this.distortionCorrection_Section.setSection( this.distortionCorrection_Control );
   this.distortionCorrection_Section.enableCheckBox( true );
   this.distortionCorrection_Section.checkBox.checked = this.solverCfg.distortionCorrection;
   this.distortionCorrection_Section.checkBox.toolTip = "<p>This option builds a model of the local distortions " +
      "of the image using approximating 2nd order 2-D surface splines, also known as <i>thin plate splines.</i></p>";
   this.distortionCorrection_Section.onCheckSection = function( sectionbar )
   {
      this.dialog.solverCfg.distortionCorrection = sectionbar.checkBox.checked;
      this.dialog.distortionCorrection_Control.enabled = this.dialog.solverCfg.distortionCorrection;
      if ( sectionbar.isCollapsed() )
         sectionbar.toggleSection();
   };
   this.distortionCorrection_Section.onToggleSection = toggleSectionHandler;

   // -------------------------------------------------------------------------
   // Control Buttons
   // -------------------------------------------------------------------------

   this.newInstanceButton = new ToolButton( this );
   this.newInstanceButton.icon = this.scaledResource( ":/process-interface/new-instance.png" );
   this.newInstanceButton.setScaledFixedSize( 24, 24 );
   this.newInstanceButton.toolTip = "New Instance";
   this.newInstanceButton.onMousePress = function()
   {
      if ( !this.dialog.Validate() )
         return;

      this.hasFocus = true;

      this.dialog.metadata.SaveParameters();
      this.dialog.solverCfg.SaveParameters();

      this.pushed = false;
      this.dialog.newInstance();
   };

   this.reset_Button = new ToolButton( this );
   this.reset_Button.icon = this.scaledResource( ":/icons/reload.png" );
   this.reset_Button.setScaledFixedSize( 24, 24 );
   this.reset_Button.toolTip = "<p>Resets script settings to factory-default values.</p>" +
      "<p>This action closes this dialog window, so the script must be executed again.</p>";
   this.reset_Button.onClick = function()
   {
      if ( (new MessageBox( "<p>Do you really want to reset all settings to their default values?</p>",
                     TITLE, StdIcon_Warning, StdButton_No, StdButton_Yes )).execute() == StdButton_Yes )
      {
         this.dialog.solverCfg.ResetSettings();
         this.dialog.resetRequest = true;
         this.dialog.cancel();
      }
   };

   this.help_Button = new ToolButton( this );
   this.help_Button.icon = this.scaledResource( ":/process-interface/browse-documentation.png" );
   this.help_Button.setScaledFixedSize( 24, 24 );
   this.help_Button.toolTip = "<p>Browse Documentation</p>";
   this.help_Button.onClick = function()
   {
      Dialog.browseScriptDocumentation( "ImageSolver" );
   };

   this.ok_Button = new PushButton( this );
   this.ok_Button.text = "OK";
   this.ok_Button.icon = this.scaledResource( ":/icons/ok.png" );
   this.ok_Button.onClick = function()
   {
      if ( !this.dialog.Validate() )
         return;

      if ( this.dialog.metadata.observationTime == 2451545.0 )
      {
         /*
          * Check for no observation time available.
          */
         if ( this.dialog.metadata.epoch == null )
            if ( (new MessageBox( "<p>You have not specified an actual observation date, and we cannot retrieve " +
                        "it from existing image metadata.</p>" +
                        "<p><b>The computed astrometric solution may not be valid as a result of wrongly " +
                        "computed star proper motions and parallaxes.</b></p>" +
                        "<p><b>Do you want to continue anyway?</b></p>",
                        TITLE, StdIcon_Warning, StdButton_No, StdButton_Yes )).execute() != StdButton_Yes )
            {
               return;
            }
      }
      else if ( this.dialog.metadata.referenceSystem != "ICRS" )
      {
         /*
          * Check for inaccurate observation time specified to solve an image
          * in the GCRS, or for the same matter, in any reference system more
          * complex than ICRS.
          */
         let A = Math.jdToCalendarTime( this.dialog.metadata.observationTime );
         let hh = Math.trunc( A[3] * 24 );
         let mm = Math.trunc( A[3] * 1440 ) - hh * 60;
         let ss = A[3] * 86400 - hh * 3600 - mm * 60;
         if ( 1 + ss == 1 )
            if ( (new MessageBox( "<p>The specified observation time may not be enough accurate to compute an " +
                        "astrometric solution in the GCRS. The GCRS requires proper positions, for " +
                        "which we have to calculate solar system ephemerides that need times specified " +
                        "with at least one-minute precision.</p>" +
                        "<p><b>The computed astrometric solution may not be valid as a result of wrongly " +
                        "computed annual aberration corrections.</b></p>" +
                        "<p><b>Do you want to continue anyway?</b></p>",
                        TITLE, StdIcon_Warning, StdButton_No, StdButton_Yes )).execute() != StdButton_Yes )
            {
               return;
            }
      }

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
   this.buttons_Sizer.spacing = 6;
   this.buttons_Sizer.add( this.newInstanceButton );
   this.buttons_Sizer.add( this.reset_Button );
   this.buttons_Sizer.add( this.help_Button );
   this.buttons_Sizer.addStretch();
   this.buttons_Sizer.add( this.ok_Button );
   this.buttons_Sizer.add( this.cancel_Button );

   // -------------------------------------------------------------------------
   // Global sizer
   // -------------------------------------------------------------------------

   this.sizer = new VerticalSizer;
   this.sizer.margin = 8;
   this.sizer.spacing = 6;
   this.sizer.add( this.helpLabel );
   this.sizer.addSpacing( 4 );
   if ( showTargetImage )
   {
      this.sizer.add( this.targetImage_Section );
      this.sizer.add( this.targetImage_Control, 100 );
   }
   this.sizer.add( this.imageParameters_Section );
   this.sizer.add( this.imageParameters_Control );
   this.sizer.add( this.modelParameters_Section );
   this.sizer.add( this.modelParameters_Control );
   this.sizer.add( this.advancedParameters_Section );
   this.sizer.add( this.advancedParameters_Control );
   this.sizer.add( this.distortionCorrection_Section );
   this.sizer.add( this.distortionCorrection_Control );
   this.sizer.add( this.buttons_Sizer );

   this.windowTitle = "Image Plate Solver Script";

   if ( showTargetImage )
   {
      this.EnableFileControls(); // which changes size constraints
      this.ensureLayoutUpdated();
      this.setFixedWidth();
   }
   else
   {
      this.ensureLayoutUpdated();
      this.adjustToContents();
      this.setFixedSize();
   }
   this.helpLabel.setFixedSize();

   // -------------------------------------------------------------------------

   this.updateCatalogSelectionControls = function()
   {
      this.dialog.localXPSDCatalog_ComboBox.enabled = this.solverCfg.catalogMode == CatalogMode.prototype.LocalXPSDServer;
      this.dialog.localStarCatalog_Edit.enabled = this.solverCfg.catalogMode == CatalogMode.prototype.LocalText;
      this.dialog.localStarCatalogSelect_Button.enabled = this.solverCfg.catalogMode == CatalogMode.prototype.LocalText;
      this.dialog.localStarCatalogDownload_Button.enabled = this.solverCfg.catalogMode == CatalogMode.prototype.LocalText;
      this.dialog.onlineStarCatalogSelect_Button.enabled = this.solverCfg.catalogMode == CatalogMode.prototype.Online;
      this.dialog.onlineStarCatalog_ComboBox.enabled = this.solverCfg.catalogMode == CatalogMode.prototype.Online;
      this.dialog.distortedCorners_CheckBox.enabled = this.solverCfg.catalogMode != CatalogMode.prototype.LocalText;
   };

   this.updateCatalogSelectionControls();

   // -------------------------------------------------------------------------

   this.Validate = function()
   {
      try
      {
         if ( this.metadata.useFocal )
         {
            if ( this.metadata.focal <= 0 )
               throw "Invalid focal length.";
            if ( this.metadata.xpixsz <= 0 || this.metadata.xpixsz > 120 )
               throw "Invalid pixel size.";
         }

         if ( !this.solverCfg.onlyOptimize )
            if ( this.metadata.resolution == null || this.metadata.resolution <= 0 || this.metadata.resolution > 1800 / 3600 )
               throw "Invalid image resolution.";

         let coords = this.coords_Editor.GetCoords();
         if ( coords.x < 0 || coords.x > 360 )
            throw "Invalid right ascension.";
         if ( coords.y < -90 || coords.y > +90 )
            throw "Invalid declination.";

         if ( this.solverCfg.useDistortionModel )
            if ( this.solverCfg.distortionModelPath == null || this.solverCfg.distortionModelPath.trim().length == 0 )
               throw "The distortion model path is empty.";

         this.metadata.ra = coords.x;
         this.metadata.dec = coords.y;

         let t = this.dateTime_Editor.getEpoch();
         if ( t != this.metadata.observationTime )
         {
            this.metadata.observationTime = t;
            if ( this.metadata.epoch == null )
               if ( t != 2451545.0 )
                  this.metadata.epoch = t;
         }

         if ( this.solverCfg.catalogMode == CatalogMode.prototype.LocalText )
            this.solverCfg.distortedCorners = false;

         return true;
      }
      catch ( ex )
      {
         (new MessageBox( ex, TITLE, StdIcon_Error )).execute();
         return false;
      }
   };
}

ImageSolverDialog.prototype = new Dialog;

// ----------------------------------------------------------------------------

/*
 * ImageSolver: Implementation of the plate solving algorithm.
 */
function ImageSolver()
{
   let error;
   this.solverCfg = new SolverConfiguration( SETTINGS_MODULE_SCRIPT );
   this.metadata = new ImageMetadata( SETTINGS_MODULE_SCRIPT );

   /*
    * Initializes the image solver. If the parameter prioritizeSettings is
    * defined and is true, the solver will use the values stored in preferences
    * instead of the values obtained from the image.
    */
   this.Init = function( window, prioritizeSettings )
   {
      function compareVersions( v1, v2 )
      {
         let a1 = v1.split( '.' );
         let a2 = v2.split( '.' );
         let n = Math.min( a1.length, a2.length );
         if ( n < 2 )
            return true; // invalid -> v1 < v2
         for ( let i = 0; i < n; ++i )
         {
            if ( a1[i] < a2[i] )
               return true; // v1 < v2
            if ( a1[i] > a2[i] )
               return false; // v1 > v2
         }
         return false; // v1 == v2
      }

      this.solverCfg.LoadSettings();
      this.solverCfg.LoadParameters();

      /*
       * ### N.B. Be compatible with versions < 4.2.4, where some catalog names
       * had leading an trailing spaces.
       */
      this.solverCfg.catalog = this.solverCfg.catalog.trim();

      /*
       * ### N.B. Version 5.5.0 introduces a new surface simplification
       * algorithm for generation of thin plate splines, where an optimal
       * simplifier tolerance in pixels is found automatically. This changes
       * the meaning of the simplifierTolerance parameter. For sanity, we'll
       * reset all surface simplification parameters if we detect an older
       * version in the previous script execution.
       */
      if ( compareVersions( this.solverCfg.version, "5.5.0" ) )
      {
         //this.solverCfg.splineSmoothing = 0.015; // see v6.0 below
         this.solverCfg.enableSimplifier = true;
         //this.solverCfg.simplifierTolerance = 0.05; // see v6.0 below
         this.solverCfg.simplifierRejectFraction = 0.10;
      }

      /*
       * ### N.B. Version 5.6.3: New StarDetector engine V2 in core 1.8.9-1:
       * reset critical star detection parameters to default values.
       */
      if ( compareVersions( this.solverCfg.version, "5.6.3" ) )
      {
         this.solverCfg.sensitivity = 0.5;
         this.solverCfg.peakResponse = 0.5;
         this.solverCfg.maxStarDistortion = 0.6;
      }

      /*
       * Since version 6.0, as a result of the new robust star matching
       * algorithm:
       *
       * - Distortion correction is now enabled by default.
       * - The default spline smoothing parameter has been reduced to 0.010 px.
       * - Simplification tolerances are calculated adaptively, hence the
       *   simplifierTolerance parameter has been removed.
       */
      if ( compareVersions( this.solverCfg.version, "6.0" ) )
      {
         this.solverCfg.distortionCorrection = true;
         this.splineSmoothing = 0.010;
      }

      if ( prioritizeSettings )
         if ( window && window.isWindow )
            this.metadata.ExtractMetadata( window );

      this.metadata.LoadSettings();
      this.metadata.LoadParameters();

      if ( !prioritizeSettings )
         if ( window && window.isWindow )
            this.metadata.ExtractMetadata( window );
   };

   /*
    * Flag true if we have already failed with polygonal descriptors, and have
    * succeeded with triangle similarity in a second attempt. This happens if
    * we are dealing with a mirrored image. This flag is necessary to support
    * multiple alignments with previews.
    */
   this.usingTriangleSimilarity = false;

   this.DoAlign = function( window, clipRect )
   {
      let SA = new StarAlignment;
      SA.referenceImage = STAR_CSV_FILE;
      SA.referenceIsFile = true;
      SA.mode = StarAlignment.prototype.OutputMatrix;
      SA.writeKeywords = false;
      SA.structureLayers = this.solverCfg.structureLayers;
      SA.minStructureSize = this.solverCfg.minStructureSize;
      SA.hotPixelFilterRadius = this.solverCfg.hotPixelFilterRadius;
      SA.noiseReductionFilterRadius = this.solverCfg.noiseReductionFilterRadius;
      SA.sensitivity = this.solverCfg.sensitivity;
      SA.peakResponse = this.solverCfg.peakResponse;
      SA.brightThreshold = this.solverCfg.brightThreshold;
      SA.maxStarDistortion = this.solverCfg.maxStarDistortion;
      SA.allowClusteredSources = true; // because we want it to match as many stars as possible at this stage
      SA.useTriangles = this.usingTriangleSimilarity;
      SA.polygonSides = 7;
      SA.restrictToPreviews = clipRect != null;
      if ( this.solverCfg.useDistortionModel )
      {
         SA.distortionModel = this.solverCfg.distortionModelPath;
         SA.undistortedReference = true;
      }

      let view = clipRect ? window.createPreview( clipRect, "ImageSolverClipArea" ) : window.currentView;
      try
      {
         if ( !SA.executeOn( view, false/*swapFile*/ ) )
         {
            /*
             * If we are using polygonal descriptors, try again using triangle
             * similarity, just in case we have a mirrored image.
             */
            let failed = true;
            if ( !this.usingTriangleSimilarity )
            {
               console.noteln( "<end><cbr><br>* Previous attempt with polygonal descriptors failed - trying with triangle similarity..." );

               SA.useTriangles = this.usingTriangleSimilarity = true;
               failed = !SA.executeOn( view, false/*swapFile*/ );
            }
            if ( failed )
               throw "The image could not be aligned with the reference star field.";
         }

         let numPairs = Math.min( SA.outputData[0][2], 4000 );
         let pairs = {
            pS: new Array( numPairs ),
            pI: new Array( numPairs )
         };
         for ( let i = 0; i < numPairs; ++i )
         {
            pairs.pS[i] = new Point( SA.outputData[0][29][i],
                                     SA.outputData[0][30][i] );
            pairs.pI[i] = new Point( SA.outputData[0][31][i] + 0.5,
                                     SA.outputData[0][32][i] + 0.5 );
         }
         return pairs;
      }
      catch ( ex )
      {
         console.criticalln( "<end><cbr><br>*** Error: ", ex.toString() );
         console.writeln( "<html>" +
            "<p>Please check the following items:</p>" +
            "<ul>" +
               "<li>The initial center coordinates should be inside the image.</li>" +
               "<li>The initial image resolution should be within a factor of 2 from the correct value.</li>" +
               "<li>If you use an online star catalog through the VizieR service, consider using " +
                  "the Gaia DR3 catalog with local XPSD databases instead.</li>" +
               "<li>If the image has extreme noise levels, bad tracking, or is poorly focused, you may " +
               "need to adjust some star detection parameters.</li>" +
            "</ul>" +
            "</html>" );
         throw "";
      }
      finally
      {
         if ( clipRect )
            window.deletePreview( view );
      }
   };

   this.GenerateTemplate = function( metadata, templateGeom )
   {
      if ( this.solverCfg.catalogMode == CatalogMode.prototype.LocalText )
      {
         this.catalog = new CustomCatalog();
         this.catalog.catalogPath = this.solverCfg.databasePath;
      }
      else
      {
         this.catalog = __catalogRegister__.GetCatalog( this.catalogName );
         this.catalog.magMax = this.limitMagnitude;
         this.catalog.restrictToHQStars = this.solverCfg.restrictToHQStars;
      }

      this.catalog.Load( metadata, this.solverCfg.vizierServer );
      if ( this.catalog.objects == null )
         throw "Catalog error: " + this.catalogName;

      let ref_G_S = templateGeom.ref_S_G.inverse();

      let file = File.createFileForWriting( STAR_CSV_FILE );
      file.outTextLn( templateGeom.width + "," + templateGeom.height );
      let elements = this.catalog.objects;
      let numStars = 0;
      let clipRectS = templateGeom.clipRectS || new Rect( 0, 0, templateGeom.width, templateGeom.height );

      for ( let i = 0; i < elements.length; ++i )
         if ( elements[i] )
         {
            let flux = (elements[i].magnitude == null) ? 0 : Math.pow( 2.512, -1.5 - elements[i].magnitude );
            let pos_G = templateGeom.projection.Direct( elements[i].posRD );
            if ( pos_G )
            {
               let pos_S = ref_G_S.Apply( templateGeom.projection.Direct( elements[i].posRD ) );
               if ( pos_S.x > clipRectS.left && pos_S.x < clipRectS.right && pos_S.y > clipRectS.top && pos_S.y < clipRectS.bottom )
               {
                  file.outTextLn( format( "%.4f,%.4f,%.3e", pos_S.x, pos_S.y, flux ) );
                  numStars++;
               }
            }
         }

      file.close();
      if ( numStars < 8 )
         throw "Found too few stars. The magnitude filter could be too strict, or the catalog server could be malfunctioning.";
   };

   this.DoIterationSA = function( window, metadata )
   {
      console.writeln( "<end><cbr>Starting StarAlignment iteration" );

      try
      {
         // Render a star field around the original coordinates
         let templateSize = Math.max( metadata.width, metadata.height );
         let templateGeom = {
            ref_S_G: new Matrix(
               -metadata.resolution, 0, metadata.resolution * templateSize / 2,
               0, -metadata.resolution, metadata.resolution * templateSize / 2,
               0, 0, 1 ),

            projection: ProjectionFactory( this.solverCfg, metadata.ra, metadata.dec ),
            width: templateSize,
            height: templateSize,
            clipRectS: null
         };

         let pairs = null;
         if ( this.solverCfg.distortionCorrection && this.solverCfg.distortedCorners )
         {
            // Align the image
            this.GenerateTemplate( metadata, templateGeom );
            let centerPairs = this.DoAlign( window, null );

            // Get simplified solution for the image
            let pG = centerPairs.pS.map( p => templateGeom.ref_S_G.Apply( p ) );
            let ref_S_G = Math.homography( centerPairs.pI, pG );
            let centerRD = templateGeom.projection.Inverse( ref_S_G.Apply( new Point( metadata.width / 2, metadata.height / 2 ) ) );
            let newProjection = ProjectionFactory( this.solverCfg, centerRD.x, centerRD.y );
            let pG2 = pG.map( p => newProjection.Direct( templateGeom.projection.Inverse( p ) ) );
            templateGeom.projection = newProjection;
            templateGeom.ref_S_G = Math.homography( centerPairs.pI, pG2 );
            console.writeln( "<end><cbr>Estimated image center: RA=", DMSangle.FromAngle( centerRD.x / 15 ).ToString( true ),
                                                            "  Dec=", DMSangle.FromAngle( centerRD.y ).ToString() );

            // Generate the pairs for all the cells using the geometry of the center cell
            pairs = {
               pS: [],
               pI: [],
               pG: null
            };
            const cornerSize = 0.25;
            let seps = [ 0, cornerSize, 1 - cornerSize, 1 ];
            for ( let cellIdx = 0; cellIdx < 9; cellIdx++ )
            {
               if ( console.abortRequested )
                  throw "Abort requested";
               let x = cellIdx % 3;
               let y = Math.floor( cellIdx / 3 );
               let cellName = [ "top", "center", "bottom" ][y] + '-' + [ "left", "center", "right" ][x];
               console.writeln( '-'.repeat( 16 ) );
               console.writeln( "Aligning " + cellName + " cell" );
               templateGeom.clipRectS = new Rect( seps[x] * metadata.width,
                  seps[y] * metadata.height,
                  seps[x + 1] * metadata.width,
                  seps[y + 1] * metadata.height );
               this.GenerateTemplate( metadata, templateGeom );
               try
               {
                  let cellPairs = this.DoAlign( window, templateGeom.clipRectS );
                  pairs.pS = pairs.pS.concat( cellPairs.pS );
                  pairs.pI = pairs.pI.concat( cellPairs.pI );
               }
               catch ( ex )
               {
                  console.warningln( "<end><cbr>Warning: Unable to align " + cellName + " cell." );
               }
            }
            pairs.pG = pairs.pS.map( p => templateGeom.ref_S_G.Apply( p ) );
         }
         else
         {
            this.GenerateTemplate( metadata, templateGeom );
            pairs = this.DoAlign( window, null );

            // Adjust to a projection with origin at the center of the image
            let pG = pairs.pS.map( p => templateGeom.ref_S_G.Apply( p ) );
            let ref_S_G = Math.homography( pairs.pI, pG );
            let centerRD = templateGeom.projection.Inverse( ref_S_G.Apply( new Point( metadata.width / 2, metadata.height / 2 ) ) );
            let newProjection = ProjectionFactory( this.solverCfg, centerRD.x, centerRD.y );
            pairs.pG = pG.map( p => newProjection.Direct( templateGeom.projection.Inverse( p ) ) );
            templateGeom.projection = newProjection;
         }

         let newMetadata = metadata.Clone();
         newMetadata.projection = templateGeom.projection;
         if ( this.distortionModel )
            this.MetadataFromDistortionModel( newMetadata, pairs.pI, pairs.pG, null );
         else if ( this.solverCfg.distortionCorrection )
         {
            newMetadata.ref_I_G_linear = Math.homography( pairs.pI, pairs.pG );
            newMetadata.ref_I_G = new ReferSpline( pairs.pI, pairs.pG, null/*weights*/,
               this.solverCfg.splineOrder,
               this.solverCfg.splineSmoothing,
               this.solverCfg.enableSimplifier,
               this.solverCfg.simplifierRejectFraction );
            processEvents();
            newMetadata.ref_G_I = new ReferSpline( pairs.pG, pairs.pI, null/*weights*/,
               this.solverCfg.splineOrder,
               this.solverCfg.splineSmoothing,
               this.solverCfg.enableSimplifier,
               this.solverCfg.simplifierRejectFraction );
            processEvents();

            newMetadata.controlPoints = {
               pI: pairs.pI,
               pG: pairs.pG
            };
         }
         else
         {
            newMetadata.ref_I_G = MultipleLinearRegression( 1, pairs.pI, pairs.pG );
            newMetadata.ref_I_G_linear = newMetadata.ref_I_G.ToLinearMatrix();
            newMetadata.ref_G_I = newMetadata.ref_I_G_linear.inverse();
            newMetadata.controlPoints = null;
         }

         // Find the celestial coordinates (RD) of the center of the original image
         // First transform from I to G and then unproject the gnomonic coords (G) to celestial (RD)
         let centerI = new Point( metadata.width / 2, metadata.height / 2 );
         let centerG = newMetadata.ref_I_G.Apply( centerI );

         let centerRD = newMetadata.projection.Inverse( centerG );
         if ( centerRD.x < 0 )
            centerRD.x += 360;
         else if ( centerRD.x > 360 )
            centerRD.x -= 360;
         newMetadata.ra = centerRD.x;
         newMetadata.dec = centerRD.y;
         let ref = newMetadata.ref_I_G_linear;
         let resx = Math.sqrt( ref.at( 0, 0 ) * ref.at( 0, 0 ) + ref.at( 0, 1 ) * ref.at( 0, 1 ) );
         let resy = Math.sqrt( ref.at( 1, 0 ) * ref.at( 1, 0 ) + ref.at( 1, 1 ) * ref.at( 1, 1 ) );
         newMetadata.resolution = ( resx + resy ) / 2;
         newMetadata.focal = newMetadata.FocalFromResolution( newMetadata.resolution );
         newMetadata.useFocal = false;

         return newMetadata;
      }
      catch ( ex )
      {
         if ( ex.length === undefined || ex.length > 0 )
            console.criticalln( "<end><cbr>*** Error: ", ex.toString() );
         return null;
      }
      finally
      {
         try
         {
            if ( File.exists( STAR_CSV_FILE ) )
               File.remove( STAR_CSV_FILE );
         }
         catch ( x )
         {
            // Propagate no further filesystem exceptions.
         }
      }
   };

   this.MetadataFromDistortionModel = function( newMetadata, pI, pG )
   {
      let starsU = [];
      for ( let i = 0; i < pI.length; ++i )
      {
         let pointU = null;
         if ( pI[i] )
         {
            let offset = this.distortModel.ref_D_offset.Apply( pI[i] );
            pointU = new Point( pI[i].x - offset.x, pI[i].y - offset.y );
         }
         starsU.push( pointU );
      }

      let ref_U_G = Math.homography( starsU, pG );

      let cpG = [];
      for ( let i = 0; i < this.distortModel.pU.length; ++i )
         cpG.push( ref_U_G.Apply( this.distortModel.pU[i] ) );

      newMetadata.ref_I_G = new ReferSpline( this.distortModel.pD, cpG,
                                    null/*weights*/, 2/*order*/, 0/*smoothing*/, false/*simplify*/ );
      newMetadata.ref_I_G_linear = Math.homography( this.distortModel.pD, cpG );
      processEvents();
      newMetadata.ref_G_I = new ReferSpline( cpG, this.distortModel.pD,
                                    null/*weights*/, 2/*order*/, 0/*smoothing*/, false/*simplify*/ );
      processEvents();
      newMetadata.controlPoints = {
         pI: this.distortModel.pD,
         pG: cpG,
         weights: null
      };
   };

   this.LoadDistortionModel = function( path )
   {
      let lines = File.readLines( path );
      if ( lines == null || lines.length < 1 )
         throw "Could not read the distortion model: " + path;

      let pD = [];
      let pU = [];
      let offset = [];
      for ( let i = 1; i < lines.length; ++i )
      {
         let tokens = lines[i].split( "," );
         if ( tokens == null || tokens.length != 4 )
            continue;
         pD.push( new Point( parseFloat( tokens[0] ), parseFloat( tokens[1] ) ) );
         pU.push( new Point( parseFloat( tokens[0] ) - parseFloat( tokens[2] ),
            parseFloat( tokens[1] ) - parseFloat( tokens[3] ) ) );
         offset.push( new Point( parseFloat( tokens[2] ), parseFloat( tokens[3] ) ) );
      }
      return {
         pD: pD,
         pU: pU,
         ref_D_U:      new ReferSpline( pD, pU,
                           null/*weights*/, 2/*order*/, 0/*smoothing*/, false/*simplify*/ ),
         ref_U_D:      new ReferSpline( pU, pD,
                           null/*weights*/, 2/*order*/, 0/*smoothing*/, false/*simplify*/ ),
         ref_D_offset: new ReferSpline( pD, offset,
                           null/*weights*/, 2/*order*/, 0/*smoothing*/, false/*simplify*/ )
      };
   };

   this.FindStarsInImage = function( window, predictedCoords )
   {
      let actualCoords = new Array( predictedCoords.length );
      for ( let i = 0; i < predictedCoords.length; ++i )
      {
         let pI = predictedCoords[i];
         if ( pI )
         {
            let s = this.starTree.search( { x0: pI.x - this.psfSearchRadius,
                                            y0: pI.y - this.psfSearchRadius,
                                            x1: pI.x + this.psfSearchRadius,
                                            y1: pI.y + this.psfSearchRadius } );
            if ( s.length > 0 )
            {
               let j = 0;
               if ( s.length > 1 )
               {
                  let star = this.starTree.objects[s[0]];
                  let dx = star.x - pI.x;
                  let dy = star.y - pI.y;
                  let d2 = dx*dx + dy*dy;
                  for ( let i = 1; i < s.length; ++i )
                  {
                     let star = this.starTree.objects[s[i]];
                     let dx = star.x - pI.x;
                     let dy = star.y - pI.y;
                     let d2i = dx*dx + dy*dy;
                     if ( d2i < d2 )
                     {
                        j = i;
                        d2 = d2i;
                     }
                  }
               }
               let star = this.starTree.objects[s[j]];
               actualCoords[i] = new Point( star.x, star.y );
            }
         }
      }

      let R = new RANSACPointMatcher;
      if ( !R.match( actualCoords, predictedCoords,
                     this.psfMinimumDistance/*tolerance*/,
                     1000/*maxIterations*/,
                     1/*klen*/, 1/*kovl*/, 1/*kreg*/, 0/*krms*/ ) )
         throw "RANSACPointMatcher: unable to find a valid set of star pair matches.";

      let P = new Array( predictedCoords.length );
      let index = R.index;
      for ( let i = 0; i < index.length; ++i )
      {
         let idx = index[i];
         P[idx] = actualCoords[idx];
      }
      return P;
   };

   this.DrawErrors = function( targetWindow, metadata, stars )
   {
      if ( !stars )
         return;
      console.writeln( "<end><cbr>Generating error map..." );

      let bmp = new Bitmap( metadata.width, metadata.height );

      // Copy the source image to the error image
      let imageOrg = targetWindow.mainView.image;
      let tmpW = new ImageWindow( metadata.width, metadata.height, imageOrg.numberOfChannels,
                                  targetWindow.bitsPerSample, targetWindow.isFloatSample, imageOrg.isColor,
                                  targetWindow.mainView.id + "_errors" );
      tmpW.mainView.beginProcess( UndoFlag_NoSwapFile );
      tmpW.mainView.image.apply( imageOrg );
      ApplySTF( tmpW.mainView, targetWindow.mainView.stf );
      tmpW.mainView.endProcess();
      bmp.assign( tmpW.mainView.image.render() );
      tmpW.forceClose();

      let g = new VectorGraphics( bmp );
      g.antialiasing = true;
      let linePen = new Pen( 0xffff4040, 1 );
      let starPen = new Pen( 0xff40ff40, 1 );
      let badStarPen = new Pen( 0xffff4040, 1 );
      for ( let i = 0; i < stars.actualCoords.length; ++i )
      {
         let predicted = metadata.Convert_RD_I( stars.starCoords[i] );
         if ( predicted )
         {
            if ( stars.actualCoords[i] )
            {
               let arrow = new Point( predicted.x + ( stars.actualCoords[i].x - predicted.x ) * 1,
                  predicted.y + ( stars.actualCoords[i].y - predicted.y ) * 1 );
               g.pen = linePen;
               g.drawLine( predicted, arrow );
               g.pen = starPen;
            }
            else
               g.pen = badStarPen;

            g.drawLine( predicted.x - 10, predicted.y, predicted.x - 5, predicted.y );
            g.drawLine( predicted.x + 10, predicted.y, predicted.x + 5, predicted.y );
            g.drawLine( predicted.x, predicted.y - 10, predicted.x, predicted.y - 5 );
            g.drawLine( predicted.x, predicted.y + 10, predicted.x, predicted.y + 5 );
         }
      }
      g.end();

      let errW = new ImageWindow( metadata.width, metadata.height,
                                  3/*channels*/, 8/*bits*/, false/*float*/, true/*color*/,
                                  targetWindow.mainView.id + "_errors" );
      errW.mainView.beginProcess( UndoFlag_NoSwapFile );
      errW.mainView.image.blend( bmp );
      errW.keywords = targetWindow.keywords;
      errW.mainView.endProcess();
      errW.show();
   };

   this.DrawStars = function( targetWindow, metadata, S, id )
   {
      let bmp = new Bitmap( metadata.width, metadata.height );
      bmp.fill( 0xffffffff );
      let g = new VectorGraphics( bmp );
      g.antialiasing = true;
      let linePen = new Pen( 0xff000000, 2 );
      g.pen = linePen;
      for ( let i = 0; i < S.length; ++i )
         if ( S[i] )
         {
            let p = S[i];
            g.drawLine( p.x - 10, p.y, p.x + 10, p.y );
            g.drawLine( p.x, p.y - 10, p.x, p.y + 10 );
         }
      g.end();

      if ( id === undefined || id.length == 0 )
         id = targetWindow.mainView.id + "_stars";
      let window = new ImageWindow( metadata.width, metadata.height,
                           1/*channels*/, 8/*bits*/, false/*float*/, false/*color*/, id );
      window.mainView.beginProcess( UndoFlag_NoSwapFile );
      window.mainView.image.blend( bmp );
      window.mainView.endProcess();
      window.show();
   };

   this.DrawSimplifiedSurface = function( targetWindow, metadata, S, suffix )
   {
      let bmp = new Bitmap( metadata.width, metadata.height );
      bmp.fill( 0xffffffff );
      let g = new VectorGraphics( bmp );
      g.antialiasing = true;
      let linePen = new Pen( 0xff000000, 2 );
      g.pen = linePen;
      for ( let i = 0; i < S.length; ++i )
      {
         let p = S[i];
         g.drawLine( p.x - 10, p.y, p.x + 10, p.y );
         g.drawLine( p.x, p.y - 10, p.x, p.y + 10 );
      }
      g.end();

      let window = new ImageWindow( metadata.width, metadata.height,
                           1/*channels*/, 8/*bits*/, false/*float*/, false/*color*/,
                           targetWindow.mainView.id + suffix + "_simplified" );
      window.mainView.beginProcess( UndoFlag_NoSwapFile );
      window.mainView.image.blend( bmp );
      window.mainView.endProcess();
      window.show();
   };

   this.DrawSimplifiedSurfaces = function( targetWindow, metadata )
   {
      console.writeln( "<end><cbr>Generating simplified surface maps..." );

      if ( !metadata.ref_I_G.simpleX || !metadata.ref_I_G.simpleY )
      {
         console.warningln( "** Warning: Internal error: No simplified surfaces available." );
         return;
      }

      this.DrawSimplifiedSurface( targetWindow, metadata, metadata.ref_I_G.simpleX, "_I_G_X" );
      this.DrawSimplifiedSurface( targetWindow, metadata, metadata.ref_I_G.simpleY, "_I_G_Y" );
   };

   this.DrawDistortions = function( targetWindow, metadata )
   {
      console.writeln( "<end><cbr>Generating distortion map..." );

      let ref_I_G_linear = metadata.ref_I_G_linear;
      if ( metadata.controlPoints )
      {
         let centerI = new Point( metadata.width / 2, metadata.height / 2 );
         let centerG = metadata.ref_I_G.Apply( centerI );
         ref_I_G_linear = MultipleLinearRegressionHelmert( metadata.controlPoints.pI, metadata.controlPoints.pG, centerI, centerG );
      }

      let cellSize = Math.max( metadata.width, metadata.height )
                   / Math.trunc( Math.max( metadata.width, metadata.height )/64 );
      let bmp = new Bitmap( metadata.width, metadata.height );
      bmp.fill( 0xffffffff ); // solid white
      let g = new VectorGraphics( bmp );
      g.antialiasing = true;

      g.pen = new Pen( 0xff800000, 2 ); // dark red
      for ( let y = 0; y < metadata.height; y += cellSize )
         for ( let x = 0; x < metadata.width; x += cellSize )
         {
            let posLinearI = new Point( x + cellSize / 2, y + cellSize / 2 );
            let posG = ref_I_G_linear.Apply( posLinearI );
            let posDistortI = metadata.ref_G_I.Apply( posG );
            if ( !posDistortI )
               continue;
            let arrow = new Point( posDistortI.x + (posLinearI.x - posDistortI.x),
                                   posDistortI.y + (posLinearI.y - posDistortI.y) );
            g.drawLine( posDistortI, arrow );
            g.drawCircle( posDistortI, 1 );
         }
      g.pen = new Pen( 0xff000000, 2 ); // black
      for ( let y = 0; y - cellSize <= metadata.height; y += cellSize )
      {
         let points = [];
         for ( let x = 0; x - cellSize <= metadata.width; x += cellSize )
         {
            let posLinearI = new Point( x, y );
            let posG = ref_I_G_linear.Apply( posLinearI );
            points.push( metadata.ref_G_I.Apply( posG ) );
         }
         g.drawPolyline( points );
      }
      for ( let x = 0; x - cellSize <= metadata.width; x += cellSize )
      {
         let points = [];
         for ( let y = 0; y - cellSize <= metadata.height; y += cellSize )
         {
            let posLinearI = new Point( x, y );
            let posG = ref_I_G_linear.Apply( posLinearI );
            points.push( metadata.ref_G_I.Apply( posG ) );
         }
         g.drawPolyline( points );
      }
      g.end();

      let window = new ImageWindow( metadata.width, metadata.height,
                                    3/*channels*/, 8/*bits*/, false/*float*/, true/*color*/,
                                    targetWindow.mainView.id + "_Distortions" );
      window.mainView.beginProcess( UndoFlag_NoSwapFile );
      window.mainView.image.blend( bmp );
      window.keywords = targetWindow.keywords;
      window.mainView.endProcess();
      window.show();
   };

   this.GenerateDistortionModel = function( metadata, path )
   {
      console.writeln( "<end><cbr>Generating distortion model: ", path );

      let file = new File();
      try
      {
         file.create( path );
         file.outTextLn( "ThinPlate,2" );

         let ref_I_G_linear = metadata.ref_I_G_linear;
         if ( metadata.controlPoints )
         {
            let centerI = new Point( metadata.width / 2, metadata.height / 2 );
            let centerG = metadata.ref_I_G.Apply( centerI );
            ref_I_G_linear = MultipleLinearRegressionHelmert( metadata.controlPoints.pI, metadata.controlPoints.pG, centerI, centerG );
         }

         for ( let y = 0; y <= 30; ++y )
            for ( let x = 0; x <= 30; ++x )
            {
               let posLinearI = new Point( metadata.width / 30 * x, metadata.height / 30 * y );
               let posG = ref_I_G_linear.Apply( posLinearI );
               let posDistortI = metadata.ref_G_I.Apply( posG );
               let dx = posDistortI.x - posLinearI.x;
               let dy = posDistortI.y - posLinearI.y;
               file.outTextLn( format( "%f,%f,%f,%f", posLinearI.x, posLinearI.y, dx, dy ) );
            }
      }
      finally
      {
         file.close();
      }
   };

   // This warning is now silenced.
   this.showedWarningOnTruncatedInputSet = true; //false;

   this.DetectStars = function( window, metadata )
   {
      /*
       * Load reference stars.
       */
      if ( !this.catalog )
         if ( this.solverCfg.catalogMode == CatalogMode.prototype.LocalText )
         {
            this.catalog = new CustomCatalog;
            this.catalog.catalogPath = this.solverCfg.databasePath;
         }
         else
         {
            this.catalog = __catalogRegister__.GetCatalog( this.catalogName );
            this.catalog.magMax = this.limitMagnitude;
            this.catalog.restrictToHQStars = this.solverCfg.restrictToHQStars;
         }
      this.catalog.Load( metadata, this.solverCfg.vizierServer );
      let catalogObjects = this.catalog.objects;
      if ( catalogObjects == null )
         throw "Catalog error: " + this.catalogName;
      if ( catalogObjects.length < 10 )
         throw "Insufficient stars found in catalog: " + this.catalogName;
      if ( catalogObjects.length > WCS_MAX_STARS_IN_SOLUTION )
         if ( !this.showedWarningOnTruncatedInputSet )
         {
            console.warningln( "<end><cbr>** Warning: Exceeded the maximum number of stars allowed. " +
               "Truncating the input set to the ", WCS_MAX_STARS_IN_SOLUTION, " brightest stars." );
            this.showedWarningOnTruncatedInputSet = true;
         }

      /*
       * Sort reference stars by magnitude in ascending order (brighter stars
       * first). Possible objects with undefined magnitudes are packed at the
       * tail of the array.
       */
      catalogObjects.sort( (a, b) => a.magnitude ? (b.magnitude ? a.magnitude - b.magnitude : -1) : (b.magnitude ? +1 : 0) );

      /*
       * Calculate image coordinates of catalog stars with the current
       * transformation.
       */
      let result = {
         projection: ProjectionFactory( this.solverCfg, metadata.ra, metadata.dec ),
         starCoords: [],
         coordsG: [],
         magnitudes: [],
         actualCoords: null
      };
      let predictedCoords = [];
      {
         let posRD = [];
         for ( let i = 0, n = Math.min( WCS_MAX_STARS_IN_SOLUTION, catalogObjects.length ); i < n; ++i )
            if ( catalogObjects[i] )
               posRD.push( catalogObjects[i].posRD );
         let posI = metadata.Convert_RD_I_Points( posRD );
         for ( let i = 0; i < posI.length; ++i )
         {
            let p = posI[i];
            if ( p &&
                 p.x >= 0 &&
                 p.y >= 0 &&
                 p.x <= metadata.width &&
                 p.y <= metadata.height )
            {
               let posG = result.projection.Direct( catalogObjects[i].posRD );
               if ( posG )
               {
                  result.coordsG.push( posG );
                  result.starCoords.push( catalogObjects[i].posRD );
                  result.magnitudes.push( catalogObjects[i].magnitude );
                  predictedCoords.push( p );
               }
            }
         }
      }

      /*
       * Find the stars in the image using predictedCoords as starting point.
       */
      result.actualCoords = this.FindStarsInImage( window, predictedCoords );

      /*
       * Remove control points with identical coordinates.
       */
      {
         let A = [];
         for ( let i = 0; i < result.actualCoords.length; ++i )
            if ( result.actualCoords[i] )
               A.push( { i: i, x: result.actualCoords[i].x, y: result.actualCoords[i].y } );
         A.sort( (a,b) => (a.x != b.x) ? a.x - b.x : a.y - b.y );
         for ( let i = 1; i < A.length; ++i )
            if ( A[i].x == A[i-1].x )
               if ( A[i].y == A[i-1].y )
               {
                  result.actualCoords[A[i].i] = null;
                  result.coordsG[A[i].i] = null;
               }
         A = [];
         for ( let i = 0; i < result.coordsG.length; ++i )
            if ( result.coordsG[i] )
               A.push( { i: i, x: result.coordsG[i].x, y: result.coordsG[i].y } );
         A.sort( (a,b) => (a.x != b.x) ? a.x - b.x : a.y - b.y );
         for ( let i = 1; i < A.length; ++i )
            if ( A[i].x == A[i-1].x )
               if ( A[i].y == A[i-1].y )
               {
                  result.actualCoords[A[i].i] = null;
                  result.coordsG[A[i].i] = null;
               }
      }

// this.DrawStars( window, metadata, predictedCoords, "predicted" );
// this.DrawStars( window, metadata, result.actualCoords, "actual" );

      /*
       * Gather information on matching errors.
       */
      result.errors = new Array( predictedCoords.length );
      result.numValid = 0;
      result.numRejected = 0;
      let meanError, sigmaError, peakError = 0, sum2 = 0;
      {
         let E = [];
         for ( let i = 0; i < predictedCoords.length; ++i )
            if ( result.actualCoords[i] )
            {
               let ex = predictedCoords[i].x - result.actualCoords[i].x;
               let ey = predictedCoords[i].y - result.actualCoords[i].y;
               let e = Math.sqrt( ex*ex + ey*ey );
               result.errors[i] = e;
               E.push( e );
               if ( e > peakError )
                  peakError = e;
               result.numValid++;
               sum2 += e*e;
            }
            else
               result.numRejected++;

         meanError = Math.median( E );
         sigmaError = Math.sqrt( Math.biweightMidvariance( E, meanError ) );
      }
      result.rms = (result.numValid > 0) ? Math.sqrt( sum2 / result.numValid ) : 0;
      result.score = Math.roundTo( result.numValid/(1 + result.rms), 3 );

      console.writeln( format( "Matching errors: median = %.2f px, sigma = %.2f px, peak = %.2f px", meanError, sigmaError, peakError ) );
      console.writeln( format( "Matched stars: %d (%d rejected)", result.numValid, result.numRejected ) );
      console.flush();

      return result;
   };

   this.DoIterationLinear = function( metadata, stars )
   {
      console.flush();
      processEvents();

      // Find referentiation matrices
      let newMetadata = metadata.Clone();
      newMetadata.projection = stars.projection;
      newMetadata.ref_I_G = Math.homography( stars.actualCoords, stars.coordsG );
      newMetadata.ref_I_G_linear = newMetadata.ref_I_G;
      newMetadata.ref_G_I = newMetadata.ref_I_G.inverse();
      newMetadata.controlPoints = null;

      // Find the celestial coordinates (RD) of the center of the original image
      // First transform from I to G and then unprojects the gnomonic coords (G) to celestial (RD)
      let centerI = new Point( metadata.width / 2, metadata.height / 2 );
      let centerG = newMetadata.ref_I_G.Apply( centerI );
      let centerRD = newMetadata.projection.Inverse( centerG );
      while ( centerRD.x < 0 )
         centerRD.x += 360;
      while ( centerRD.x > 360 )
         centerRD.x -= 360;
      newMetadata.ra = ( Math.abs( metadata.ra - centerRD.x ) < 1 ) ? ( metadata.ra + centerRD.x * 2 ) / 3 : centerRD.x;
      newMetadata.dec = ( Math.abs( metadata.dec - centerRD.y ) < 1 ) ? ( metadata.dec + centerRD.y * 2 ) / 3 : centerRD.y;
      let ref = newMetadata.ref_I_G_linear;
      let resx = Math.sqrt( ref.at( 0, 0 ) * ref.at( 0, 0 ) + ref.at( 0, 1 ) * ref.at( 0, 1 ) );
      let resy = Math.sqrt( ref.at( 1, 0 ) * ref.at( 1, 0 ) + ref.at( 1, 1 ) * ref.at( 1, 1 ) );
      newMetadata.resolution = ( resx + resy ) / 2;
      newMetadata.focal = newMetadata.FocalFromResolution( newMetadata.resolution );
      newMetadata.useFocal = false;

      return newMetadata;
   };

   this.DoIterationSpline = function( metadata, stars )
   {
      console.flush();
      processEvents();

      // Find referentiation matrices
      let newMetadata = metadata.Clone();
      newMetadata.projection = stars.projection;
      if ( this.distortModel != null )
      {
         this.MetadataFromDistortionModel( newMetadata, stars.actualCoords, stars.coordsG );
      }
      else
      {
         newMetadata.ref_I_G = new ReferSpline( stars.actualCoords, stars.coordsG, null/*weights*/,
            this.solverCfg.splineOrder,
            this.solverCfg.splineSmoothing,
            this.solverCfg.enableSimplifier,
            this.solverCfg.simplifierRejectFraction );

         newMetadata.ref_I_G_linear = Math.homography( stars.actualCoords, stars.coordsG );
         processEvents();

         newMetadata.ref_G_I = new ReferSpline( stars.coordsG, stars.actualCoords, null/*weights*/,
            this.solverCfg.splineOrder,
            this.solverCfg.splineSmoothing,
            this.solverCfg.enableSimplifier,
            this.solverCfg.simplifierRejectFraction );
         processEvents();

         newMetadata.controlPoints = {
            pI: stars.actualCoords,
            pG: stars.coordsG,
            weights: null
         };
      }

      // Find the celestial coordinates (RD) of the center of the original image
      // First transform from I to G and then unprojects the gnomonic coords (G) to celestial (RD)
      let centerI = new Point( metadata.width / 2, metadata.height / 2 );
      let centerG = newMetadata.ref_I_G.Apply( centerI );
      let centerRD = newMetadata.projection.Inverse( centerG );
      while ( centerRD.x < 0 )
         centerRD.x += 360;
      while ( centerRD.x > 360 )
         centerRD.x -= 360;
      newMetadata.ra = ( Math.abs( metadata.ra - centerRD.x ) < 1 ) ? ( metadata.ra + centerRD.x * 2 ) / 3 : centerRD.x;
      newMetadata.dec = ( Math.abs( metadata.dec - centerRD.y ) < 1 ) ? ( metadata.dec + centerRD.y * 2 ) / 3 : centerRD.y;
      let ref = newMetadata.ref_I_G_linear;
      let resx = Math.sqrt( ref.at( 0, 0 ) * ref.at( 0, 0 ) + ref.at( 0, 1 ) * ref.at( 0, 1 ) );
      let resy = Math.sqrt( ref.at( 1, 0 ) * ref.at( 1, 0 ) + ref.at( 1, 1 ) * ref.at( 1, 1 ) );
      newMetadata.resolution = ( resx + resy ) / 2;
      newMetadata.focal = newMetadata.FocalFromResolution( newMetadata.resolution );
      newMetadata.useFocal = false;

      return newMetadata;
   };

   this.GenerateWorkingImage = function( targetWindow )
   {
      // Convert the image to grayscale.
      // The chrominance is not necessary for the astrometry.
      let grayscaleImage = new Image;
      grayscaleImage.assign( targetWindow.mainView.image );
      grayscaleImage.colorSpace = ColorSpace_HSI;
      grayscaleImage.selectedChannel = 2; // intensity component

      let workingWindow = new ImageWindow( grayscaleImage.width, grayscaleImage.height,
                                    1/*channels*/, 32/*bits*/, true/*float*/, false/*color*/,
                                    targetWindow.mainView.id + "_working" );
      workingWindow.mainView.beginProcess( UndoFlag_NoSwapFile );
      workingWindow.mainView.image.apply( grayscaleImage );
      workingWindow.mainView.endProcess();

      // Deallocate now, don't wait for garbage collection.
      grayscaleImage.free();

      return workingWindow;
   };

   this.CalculateMetadataDelta = function( metadata1, metadata2 )
   {
      // Calculate the difference between the last two iterations using the displacement of the center and one corner
      let cornerI = new Point( 0, 0 );
      let cornerRD2 = metadata2.Convert_I_RD( cornerI );
      let cornerRD1 = metadata1.ref_I_G ? metadata1.Convert_I_RD( cornerI ) : cornerRD2;
      let delta1 = 0;
      if ( cornerRD1 )
         delta1 = Math.sqrt( Math.pow( ( cornerRD1.x - cornerRD2.x ) * Math.cos( Math.rad( cornerRD2.y ) ), 2 ) +
            Math.pow( ( cornerRD1.y - cornerRD2.y ), 2 ) ) * 3600;
      let delta2 = Math.sqrt( Math.pow( ( metadata2.ra - metadata1.ra ) * Math.cos( Math.rad( metadata2.dec ) ), 2 ) +
         Math.pow( metadata2.dec - metadata1.dec, 2 ) ) * 3600;
      return Math.max( delta1, delta2 );
   };

   this.OptimizeSolution = function( workingWindow, currentMetadata, stars )
   {
      let finish = false;
      let iteration = 1;
      let lastImprovement = 0;
      let maxItersNoImprovement = this.solverCfg.distortionCorrection /*&& !this.distortModel*/ ? 4 : 2;
      let bestMetadata = currentMetadata;
      let bestScore = stars.score;

      while ( !finish )
      {
         console.abortEnabled = true;

         let result;
         try
         {
            if ( this.solverCfg.distortionCorrection )
               result = this.DoIterationSpline( currentMetadata, stars );
            else
               result = this.DoIterationLinear( currentMetadata, stars );

            if ( result == null )
               throw "";
         }
         catch ( ex )
         {
            console.abortEnabled = false;
            let haveException = ex.length === undefined || ex.length > 0;
            if ( haveException )
               console.criticalln( "<end><cbr><br>*** Error: " + ex.toString() );
            console.criticalln( "<end><cbr>" +
               (haveException ? "" : "<br>*** Error: ") +
               "The image could not be fully solved. We have tagged it with the latest known valid solution." );
            break;
         }

         stars = this.DetectStars( workingWindow, result );

         // Calculate the difference between the last two iterations using the displacement of the center and one corner
         let delta = this.CalculateMetadataDelta( currentMetadata, result );

         // Show iteration info
         console.writeln( "<end><cbr><br>*****" );
         console.writeln(    format( "Iteration %d, delta = %.3f as (%.2f px)", iteration, delta, delta / ( result.resolution * 3600 ) ) );
         console.writeln(            "Image center ... RA: ", DMSangle.FromAngle( result.ra / 15 ).ToString( true ),
                                                   "  Dec: ", DMSangle.FromAngle( result.dec ).ToString() );
         console.writeln(    format( "Resolution ..... %.2f as/px", result.resolution * 3600 ) );
         console.writeln(    format( "RMS error ...... %.3f px (%d stars)", stars.rms, stars.numValid ) );
         if ( stars.score > bestScore )
            console.writeln( format( "Score .......... \x1b[38;2;128;255;128m%.3f\x1b[0m", stars.score ) );
         else
            console.writeln( format( "Score .......... %.3f", stars.score ) );
         console.writeln( "*****" );
         currentMetadata = result;

         if ( stars.score > bestScore )
         {
            lastImprovement = 0;
            bestMetadata = result;
            bestScore = stars.score;
         }
         else
            lastImprovement++;

         if ( this.distortModel && lastImprovement > 2 )
         {
            lastImprovement = 0;
            this.distortModel = null;
            console.noteln( "* The solution with distortion model has converged. Trying to optimize it without the model." );
         }

         // Finish condition
         finish = true;
         if ( iteration > this.solverCfg.maxIterations )
            console.warningln( "** Warning: Reached maximum number of iterations." );
         else if ( lastImprovement > maxItersNoImprovement )
            console.noteln( "* Reached maximum number of iterations without further improvement." );
         else
            finish = false;

         iteration++;

         console.abortEnabled = true;
         processEvents();
         if ( console.abortRequested )
         {
            finish = true;
            console.criticalln( "*** User requested abort ***" );
         }
         gc( true );
      } // while ( !finish )

      console.noteln( format( "* Successful astrometry optimization. Score = %.3f", bestScore ) );
      console.writeln();
      return bestMetadata;
   };

   this.SolveImage = function( targetWindow )
   {
      this.error = false;

      let abortableBackup = jsAbortable;
      jsAbortable = true;
      let auxWindow = null;

      try
      {
         console.show();
         console.abortEnabled = true;

         let workingWindow = targetWindow;
         if ( targetWindow.mainView.image.isColor )
            auxWindow = workingWindow = this.GenerateWorkingImage( targetWindow );

         /*
          * Build a bucket region quadtree structure with all detected stars in
          * the image for fast star matching.
          */
         try
         {
            /*
             * Step 1 - Star detection
             */
            let D = new StarDetector;
            D.structureLayers = this.solverCfg.structureLayers;
            D.hotPixelFilterRadius = this.solverCfg.hotPixelFilterRadius;
            D.noiseReductionFilterRadius = this.solverCfg.noiseReductionFilterRadius;
            D.sensitivity = this.solverCfg.sensitivity;
            D.peakResponse = this.solverCfg.peakResponse;
            D.allowClusteredSources = false;
            D.maxDistortion = this.solverCfg.maxStarDistortion;
            D.brightThreshold = this.solverCfg.brightThreshold;
            D.minStructureSize = this.solverCfg.minStructureSize;
            let lastProgressPc = 0;
            D.progressCallback =
               ( count, total ) =>
               {
                  if ( count == 0 )
                  {
                     console.write( "<end><cbr>Detecting stars:   0%" );
                     lastProgressPc = 0;
                     processEvents();
                  }
                  else
                  {
                     let pc = Math.round( 100*count/total );
                     if ( pc > lastProgressPc )
                     {
                        console.write( format( "<end>\b\b\b\b%3d%%", pc ) );
                        lastProgressPc = pc;
                        processEvents();
                     }
                  }
                  return true;
               };

            let S = D.stars( workingWindow.mainView.image );
            this.numberOfDetectedStars = S.length;
            if ( this.numberOfDetectedStars < 6 )
               throw "Insufficient stars detected: found " + this.numberOfDetectedStars.toString() + ", at least 6 are required.";


            console.writeln( format( "<end><cbr>%d stars found ", this.numberOfDetectedStars ) );
            console.flush();

            /*
             * Step 2 - PSF fitting
             */
            let stars = [];
            let minStructSize = Number.POSITIVE_INFINITY;
            for ( let i = 0; i < S.length; ++i )
            {
               let p = S[i].pos;
               let r = S[i].rect;
               stars.push( [ 0, 0, DynamicPSF.prototype.Star_DetectedOk,
                             r.x0, r.y0, r.x1, r.y1,
                             p.x, p.y ] );
               let m = Math.max( r.x1 - r.x0, r.y1 - r.y0 );
               if ( m < minStructSize )
                  minStructSize = m;
            }

            let P = new DynamicPSF;
            P.views = [ [ workingWindow.mainView.id ] ];
            P.stars = stars;
            P.astrometry = false;
            P.autoAperture = true;
            P.searchRadius = minStructSize;
            P.circularPSF = false;
            P.autoPSF = this.solverCfg.autoPSF;
            P.gaussianPSF = true;
            P.moffatPSF = P.moffat10PSF = P.moffat8PSF =
               P.moffat6PSF = P.moffat4PSF = P.moffat25PSF =
               P.moffat15PSF = P.lorentzianPSF = this.solverCfg.autoPSF;
            P.variableShapePSF = false;
            if ( !P.executeGlobal() )
               throw "Unable to execute DynamicPSF process.";

            console.flush();

            stars = [];
            for ( let psf = P.psf, i = 0; i < psf.length; ++i )
            {
               let p = psf[i];
               if ( p[3] == DynamicPSF.prototype.PSF_FittedOk )
               {
                  let x = p[6];
                  let y = p[7];
                  let rx = p[8]/2;
                  let ry = p[9]/2;
                  stars.push( {
                     x: x, y: y,
                     rect: {
                        x0: x - rx, y0: y - ry,
                        x1: x + rx, y1: y + ry
                     }
                  } );
               }
            }

            /*
             * Step 3 - Remove potential duplicate objects
             */
            this.starTree = new BRQuadTree( stars.slice(), 256/*bucketSize*/ );
            stars = [];
            for ( let i = 0; i < this.starTree.objects.length; ++i )
            {
               let o = this.starTree.objects[i];
               let s = this.starTree.search( { x0: o.x - 1, y0: o.y - 1,
                                               x1: o.x + 1, y1: o.y + 1 } );
               if ( s.length == 1 )
                  stars.push( o );
            }
            if ( stars.length < 6 )
               throw "Insufficient number of objects: found " + stars.length.toString() + ", at least 6 are required.";

            console.write( format( "<end><cbr>* Removed %d conflicting sources (%.2f %%)",
                                   this.starTree.objects.length - stars.length, 100*(this.starTree.objects.length - stars.length)/stars.length ) );

            /*
             * Step 4 - Quadtree generation
             */
            this.starTree.build( stars.slice(), 256/*bucketSize*/ );
            console.write( format( "<end><cbr>* Search quadtree generated with %d objects, %d node(s), height = %d",
                                   this.starTree.objects.length, this.starTree.numberOfNodes(), this.starTree.height() ) );

            /*
             * Step 5 - Calculate search and matching tolerances
             */
            this.psfMinimumDistance = Math.min( stars[0].rect.x1 - stars[0].rect.x0,
                                                stars[0].rect.y1 - stars[0].rect.y0 );
            for ( let i = 1; i < stars.length; ++i )
            {
               let s = stars[i];
               let d = Math.min( stars[i].rect.x1 - stars[i].rect.x0,
                                 stars[i].rect.y1 - stars[i].rect.y0 );
               if ( d < this.psfMinimumDistance )
                  this.psfMinimumDistance = d;
            }
            this.psfMinimumDistance = Math.max( 2, this.psfMinimumDistance-2 ); // StarDetector inflates detection regions
            this.psfSearchRadius = 1.0 * this.psfMinimumDistance;
            console.writeln( format( "<end><cbr>* Star matching tolerance: %d px", this.psfMinimumDistance ) );
            console.flush();
         }
         catch ( ex )
         {
            this.starTree = null;
            gc();
            throw ex;
         }

         /*
          * Find limit magnitude.
          */
         if ( this.solverCfg.autoMagnitude || this.solverCfg.catalogMode == CatalogMode.prototype.Automatic )
         {
            let fov = this.metadata.resolution * Math.max( this.metadata.width, this.metadata.height );
            // Empiric formula for 1000 stars at 20 deg of galactic latitude
            let m = 14.5 * Math.pow( fov, -0.179 );
            m = Math.round( 100 * Math.min( 20, Math.max( 7, m ) ) ) / 100;

            /*
             * Identify a local XPSD server and use it if available to find an
             * optimal magnitude limit adaptively.
             */
            let xpsd = ((typeof Gaia) != 'undefined') ? (new Gaia) : null;
            if ( xpsd )
            {
               xpsd.command = "get-info";
               xpsd.dataRelease = Gaia.prototype.DataRelease_BestAvailable;
               xpsd.executeGlobal();
               if ( xpsd.isValid )
               {
                  if ( this.solverCfg.autoMagnitude )
                  {
                     const radiusPx = Math.SQRT2 * Math.sqrt( this.metadata.width * this.metadata.height ) / 2;
                     const targetStarCount = this.numberOfDetectedStars * 1.25;

                     console.writeln( format( "<end><cbr><br>Searching for optimal magnitude limit. Target = %u stars", targetStarCount ) );

                     xpsd.command = "search";
                     xpsd.centerRA = this.metadata.ra;
                     xpsd.centerDec = this.metadata.dec;
                     xpsd.radius = this.metadata.resolution * radiusPx;
                     xpsd.magnitudeLow = -1.5;
                     xpsd.sourceLimit = 0; // do not retrieve objects, just count them.
                     xpsd.exclusionFlags = GaiaFlag_NoPM;
                     xpsd.inclusionFlags = this.solverCfg.restrictToHQStars ? GaiaFlag_GoodAstrometry : 0;
                     xpsd.verbosity = 0; // work quietly
                     xpsd.generateTextOutput = false;

                     const MAX_AUTOMAG_ITER = 100; // prevent a hypothetical case where the loop might stall
                     for ( let m0 = 7, m1 = xpsd.databaseMagnitudeHigh, i = 0; i < MAX_AUTOMAG_ITER; ++i )
                     {
                        xpsd.magnitudeHigh = m;
                        xpsd.executeGlobal();
                        console.writeln( format( "<end><cbr>m = %.2f, %u stars", m, xpsd.excessCount ) );
                        if ( xpsd.excessCount < targetStarCount )
                        {
                           if ( m1 - m < 0.05 )
                              break;
                           m0 = m;
                           m += (m1 - m)/2;
                        }
                        else if ( xpsd.excessCount > 1.05*targetStarCount )
                        {
                           if ( m - m0 < 0.05 )
                              break;
                           m1 = m;
                           m -= (m - m0)/2;
                        }
                        else
                           break;
                     }
                  }
               }
               else
               {
                  /*
                   * We have a local XPSD server, but either it is not well
                   * configured, or there are no database files available.
                   */
                  xpsd = null;
               }
            }

            if ( this.solverCfg.autoMagnitude )
            {
               this.limitMagnitude = m;
               console.noteln( "<end><cbr><br>* Using an automatically calculated limit magnitude of " + format( "%.2f", m ) + "." );
            }
            else
               this.limitMagnitude = this.solverCfg.magnitude;

            if ( this.solverCfg.catalogMode == CatalogMode.prototype.Automatic )
            {
               /*
                * - For magnitude limits below 8, use the Bright Stars catalog.
                * - Otherwise:
                *    - Use a local XPSD server when available.
                *    - Otherwise:
                *       - Use the online Gaia DR2 catalog if FOV <= 3 deg.
                *       - Use the online TYCHO-2 catalog if FOV > 3 deg.
                */
               if ( this.limitMagnitude < 8 )
                  this.catalogName = "Bright Stars";
               else if ( fov > 3 && !xpsd )
                  this.catalogName = "TYCHO-2";
               else if ( xpsd )
               {
                  switch ( xpsd.outputDataRelease )
                  {
                  default:
                  case Gaia.prototype.DataRelease_3:
                     this.catalogName = "GaiaDR3_XPSD";
                     break;
                  case Gaia.prototype.DataRelease_E3:
                     this.catalogName = "GaiaEDR3_XPSD";
                     break;
                  case Gaia.prototype.DataRelease_2:
                     this.catalogName = "GaiaDR2_XPSD";
                     break;
                  }
               }
               else
                  this.catalogName = "GaiaDR2";

               console.noteln( "<end><cbr>* Using the automatically selected " + this.catalogName + " catalog." );
            }
            else
               this.catalogName = this.solverCfg.catalog;
         }
         else
         {
            this.limitMagnitude = this.solverCfg.magnitude;
            this.catalogName = this.solverCfg.catalog;
         }

         console.writeln( "Seed parameters for plate solving:" );
         console.writeln( "   Center coordinates: RA = ",
            DMSangle.FromAngle( this.metadata.ra / 15 ).ToString( true ), ", Dec = ",
            DMSangle.FromAngle( this.metadata.dec ).ToString() );
         console.writeln( format( "   Resolution: %.3f as/px", this.metadata.resolution * 3600 ) );
         console.writeln();

         let stars = null;

         if ( this.solverCfg.distortionCorrection && this.solverCfg.useDistortionModel )
         {
            if ( this.solverCfg.distortionModelPath == null || this.solverCfg.distortionModelPath.length == 0 )
               throw "No distortion model file has been specified.";
            this.distortModel = this.LoadDistortionModel( this.solverCfg.distortionModelPath );
         }
         else
            this.distortModel = null;

         /*
          * Initial Alignment.
          */
         try
         {
            if ( this.solverCfg.onlyOptimize )
               this.metadata.ExtractMetadata( targetWindow );
            else
            {
               let result = this.DoIterationSA( targetWindow, this.metadata );
               if ( !result )
                  throw "";
               this.metadata = result;
            }

            stars = this.DetectStars( workingWindow, this.metadata );

            console.writeln( "<end><cbr><br>*****" );
            console.writeln(         "Initial alignment" );
            console.writeln(         "Image center ... RA: ", DMSangle.FromAngle( this.metadata.ra / 15 ).ToString( true ),
                                                   "  Dec: ", DMSangle.FromAngle( this.metadata.dec ).ToString() );
            console.writeln( format( "Resolution ..... %.2f as/px", this.metadata.resolution * 3600 ) );
            console.writeln( format( "RMS error ...... %.3f px (%d stars)", stars.rms, stars.numValid ) );
            console.writeln( format( "Score .......... %.3f", stars.score ) );
            console.writeln( "*****" );
         }
         catch ( ex )
         {
            if ( ex.length === undefined || ex.length > 0 )
               console.criticalln( "<end><cbr><br>*** Error: " + ex.toString() );
            this.error = true;
            return false;
         }

         /*
          * Optimize the solution if requested or required.
          */
         if ( this.solverCfg.optimizeSolution || this.solverCfg.onlyOptimize )
            this.metadata = this.OptimizeSolution( workingWindow, this.metadata, stars );

         /*
          * Update metadata and regenerate the astrometric solution.
          */
         targetWindow.mainView.beginProcess( UndoFlag_Keywords | UndoFlag_AstrometricSolution );
         this.metadata.SaveKeywords( targetWindow, false/*beginProcess*/ );
         this.metadata.SaveProperties( targetWindow, "ImageSolver " + SOLVERVERSION, this.catalog.name );
         targetWindow.regenerateAstrometricSolution();
         targetWindow.mainView.endProcess();

         /*
          * Generate a distortion model if requested.
          */
         if ( this.solverCfg.distortionCorrection && this.solverCfg.generateDistortModel )
         {
            let modelPath = null;
            let filePath = targetWindow.filePath;
            if ( filePath.length > 0 )
            {
               let modelDir = File.extractDrive( filePath ) +
                  File.extractDirectory( filePath );
               let info = new FileInfo( modelDir );
               if ( info.isWritable )
               {
                  if ( !modelDir.endsWith( '/' ) )
                     modelDir += '/';
                  modelPath = modelDir +
                     File.extractName( filePath ) +
                     "_model.csv";
               }
            }

            if ( modelPath == null )
            {
               let ofd = new SaveFileDialog;
               ofd.caption = "Save Distortion Model File";
               ofd.filters = [
                  [ "Distortion models", "*.csv" ]
               ];
               if ( filePath.length > 0 )
                  ofd.initialPath = File.changeExtension( filePath, ".csv" );
               if ( ofd.execute() )
                  modelPath = ofd.fileName;
            }

            if ( modelPath != null )
               this.GenerateDistortionModel( this.metadata, modelPath );
         }

         /*
          * Generate the requested control images.
          */
         if ( this.solverCfg.showStars )
            this.DrawStars( targetWindow, this.metadata, this.starTree.objects );

         if ( this.solverCfg.distortionCorrection )
         {
            if ( this.solverCfg.showDistortion )
               this.DrawDistortions( targetWindow, this.metadata );

            if ( this.solverCfg.enableSimplifier )
               if ( this.solverCfg.showSimplifiedSurfaces )
                  this.DrawSimplifiedSurfaces( targetWindow, this.metadata );
         }

         if ( this.solverCfg.generateErrorImg )
         {
            stars = this.DetectStars( workingWindow, this.metadata );
            this.DrawErrors( targetWindow, this.metadata, stars );
         }

         return true;
      }
      catch ( ex )
      {
         this.error = true;
         throw ex;
      }
      finally
      {
         jsAbortable = abortableBackup;
         if ( auxWindow )
            auxWindow.forceClose();
      }
   };

   this.SaveImage = function( window )
   {
      if ( this.solverCfg.outSuffix.length == 0 )
         window.save();
      else
      {
         let newPath = File.extractDrive( window.filePath ) +
            File.extractDirectory( window.filePath ) + "/" +
            File.extractName( window.filePath ) +
            this.solverCfg.outSuffix +
            File.extractCompleteSuffix( window.filePath );
         window.saveAs( newPath,
            false /*queryOptions*/ ,
            false /*allowMessages*/ ,
            true  /*strict*/ ,
            false /*verifyOverwrite*/ );
      }
   };
}

// ----------------------------------------------------------------------------
// Entry point
// ----------------------------------------------------------------------------

#ifndef USE_SOLVER_LIBRARY

function main()
{
   jsScriptInformation = "ImageSolver " + SOLVERVERSION;

   if ( Parameters.getBoolean( "resetSettingsAndExit" ) )
   {
      Settings.remove( SETTINGS_MODULE );
      return;
   }

   if ( Parameters.getBoolean( "resetSettings" ) )
      Settings.remove( SETTINGS_MODULE );

   let solver = new ImageSolver;

   if ( Parameters.isViewTarget )
   {
      let targetWindow = Parameters.targetView.window;

      solver.Init( Parameters.targetView.window );

      if ( solver.SolveImage( targetWindow ) )
      {
         solver.metadata.SaveSettings();

         // Print result
         console.writeln( "<end><cbr><br>Image Plate Solver script version ", SOLVERVERSION );
         console.writeln( "=".repeat( 79 ) );
         console.writeln( targetWindow.astrometricSolutionSummary() );
         ++__PJSR_AdpImageSolver_SuccessCount;
      }
   }
   else
   {
      let targetWindow = ImageWindow.activeWindow;

      if ( Parameters.getBoolean( "non_interactive" ) )
         solver.Init( targetWindow, false /*prioritizeSettings*/ );
      else
      {
         let dialog;
         for ( ;; )
         {
            solver.Init( targetWindow, false /*prioritizeSettings*/ );
            dialog = new ImageSolverDialog( solver.solverCfg, solver.metadata, true /*showTargetImage*/ );
            if ( dialog.execute() )
               break;
            if ( !dialog.resetRequest )
               return;
            solver = new ImageSolver();
         }

         if ( solver.error )
            return;

         solver.solverCfg = dialog.solverCfg;
         solver.solverCfg.SaveSettings();

         solver.metadata = dialog.metadata;
         solver.metadata.SaveSettings();
      }

      if ( solver.solverCfg.useActive )
      {
         if ( solver.SolveImage( targetWindow ) )
         {
            solver.metadata.SaveSettings();

            // Print result
            console.writeln( "<end><cbr><br>Image Plate Solver script version ", SOLVERVERSION );
            console.writeln( "=".repeat( 79 ) );
            console.writeln( targetWindow.astrometricSolutionSummary() );
            ++__PJSR_AdpImageSolver_SuccessCount;
         }
      }
      else
      {
         if ( solver.solverCfg.files.length == 0 )
            throw "No image files have been selected.";
         let errorList = [];
         for ( let i = 0; i < solver.solverCfg.files.length; ++i )
         {
            let filePath = solver.solverCfg.files[i];
            let fileWindow = null;
            try
            {
               console.writeln( "<end><cbr><br>" + "*".repeat( 32 ) );
               console.writeln( "Processing image ", filePath );
               fileWindow = ImageWindow.open( filePath )[0];
               if ( !fileWindow )
               {
                  errorList.push(
                     {
                        id: File.extractNameAndExtension( filePath ),
                        message: "The file could not be opened"
                     } );
                  continue;
               }
               solver.Init( fileWindow, false /*prioritizeSettings*/ );
               solver.metadata.width = fileWindow.mainView.image.width;
               solver.metadata.height = fileWindow.mainView.image.height;
               if ( solver.SolveImage( fileWindow ) )
               {
                  solver.SaveImage( fileWindow );
                  console.writeln( "<end><cbr><br>", filePath );
                  console.writeln( "=".repeat( 79 ) );
                  console.writeln( fileWindow.astrometricSolutionSummary() );
                  ++__PJSR_AdpImageSolver_SuccessCount;
               }
               else
                  errorList.push(
                     {
                        id: File.extractNameAndExtension( filePath ),
                        message: "The image could not be plate solved"
                     } );
            }
            catch ( ex )
            {
               console.criticalln( "<end><cbr><br>" + '*'.repeat( 32 ) );
               console.criticalln( "Failed: <raw>" + filePath + "</raw>" +
                  ((!ex.length || ex.length > 0) ? ": " + ex.toString() : "") );
               console.criticalln( '*'.repeat( 32 ) );
               errorList.push(
                  {
                     id: File.extractNameAndExtension( filePath ),
                     message: ex.toString()
                  } );
            }

            if ( fileWindow )
               fileWindow.forceClose();

            gc( true/*exhaustive*/ );
         }

         console.writeln();
         if ( errorList.length > 0 )
         {
            console.warningln( "<end><cbr><br>** Warning: Process finished with errors:" );
            for ( let i = 0; i < errorList.length; ++i )
               console.criticalln( errorList[i].id +
                     ((errorList[i].message.length > 0) ? ": " + errorList[i].message : "") );
         }
         else
            console.noteln( "<end><cbr>* Process finished without errors." );
      }
   }
}

main();

#endif // !USE_SOLVER_LIBRARY

#undef USE_SOLVER_LIBRARY
