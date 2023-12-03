// ----------------------------------------------------------------------------
// GraXpert JavaScript Runtime
// ----------------------------------------------------------------------------
// GraXpert.js - Released 2023-11-12T16:39:54Z
// ----------------------------------------------------------------------------
//
// PixInsight script to run GraXpert command line for background extraction.
//
// Copyright (c) 2023 Joël Vallier (joel.vallier@gmail.com)
//
// Redistribution and use in both source and binary forms, with or without
// modification, is permitted provided that the following conditions are met:
//
// 1. All redistributions of source code must retain the above copyright
//    notice, this list of conditions and the following disclaimer.
//
// 2. All redistributions in binary form must reproduce the above copyright
//    notice, this list of conditions and the following disclaimer in the
//    documentation and/or other materials provided with the distribution.
//
// 3. Neither the names "PixInsight" and "Pleiades Astrophoto", nor the names
//    of their contributors, may be used to endorse or promote products derived
//    from this software without specific prior written permission. For written
//    permission, please contact info@pixinsight.com.
//
// 4. All products derived from this software, in any form whatsoever, must
//    reproduce the following acknowledgment in the end-user documentation
//    and/or other materials provided with the product:
//
//    "This product is based on software from the PixInsight project, developed
//    by Pleiades Astrophoto and its contributors (https://pixinsight.com/)."
//
//    Alternatively, if that is where third-party acknowledgments normally
//    appear, this acknowledgment must be reproduced in the product itself.
//
// THIS SOFTWARE IS PROVIDED BY PLEIADES ASTROPHOTO AND ITS CONTRIBUTORS
// "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED
// TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
// PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL PLEIADES ASTROPHOTO OR ITS
// CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
// EXEMPLARY OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, BUSINESS
// INTERRUPTION; PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; AND LOSS OF USE,
// DATA OR PROFITS) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
// CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
// ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
// POSSIBILITY OF SUCH DAMAGE.
// ----------------------------------------------------------------------------

// ======== #release information ==============================================
// 
// v0.01 12/11/23 
// - First release based on GraXpert version 2.0.2.
// v0.02 19/11/23 
// - Release based on enhanced Command Line Interface of GraXpert version 2.0.2.
// v0.03 23/11/23 
// - Extract background model by default.
// - Drag & Drop of new instance icon apply process on target image.
// - Fix error undefined ImageMetadata when create new image selected.
// - Fix undeclared variables (engine and ai_model) on first launching.
// v0.04 26/11/2023
// - Save custom default parameters and reset to Default
// - Automatic configurable path to GraXpert App 
// v0.05 03/12/2023
// - Compatibility with GraXpert and GradXtractAI.
//
// For any support or suggestion related to this script please send email 
// to joel.vallier@gmail.com. For GraXpert information, refer official website 
// https://www.graxpert.com/
//
// ============================================================================

#feature-id    GraXpert : Utilities > GraXpert

#feature-icon  @script_icons_dir/GraXpert.svg

#feature-info  GraXpert AI image processing.<br/>

#include <pjsr/DataType.jsh>
#include <pjsr/FrameStyle.jsh>
#include <pjsr/Sizer.jsh>
#include <pjsr/NumericControl.jsh>
#include <pjsr/ProcessError.jsh>
#include <pjsr/UndoFlag.jsh>

// include required for the definition of ImageMetadata
#define SETTINGS_MODULE "GraXpert"
#include "../AdP/WCSmetadata.jsh"

#define TITLE "GraXpert"
#define VERSION "0.05"

// set GraXpert folder used to store path and preferences
#ifeq __PI_PLATFORM__ MACOSX
#define GRAXPERT_HOME_DIR File.homeDirectory+"/Library/Application Support/GraXpert"
#endif
#ifeq __PI_PLATFORM__ MSWINDOWS
#define GRAXPERT_HOME_DIR File.homeDirectory+"/AppData/Local/GraXpert"
#else
// FIXME: GRAXPERT_HOME_DIR for Linux")
#endif

#define PACKAGE_URL "https://drive.google.com/drive/folders/1L7l1ngw-5wArhWOZ9IDa2pFL0dGIu8Au?usp=sharing"
#define APP_PATH GRAXPERT_HOME_DIR+"/path.cfg"
#define PREFERENCES GRAXPERT_HOME_DIR+"/preferences.cfg"

/*
 * define some utils
 */
function getPreferences(defaultValues=false) {
	let preferences = undefined
	
	if ( !defaultValues && File.exists(PREFERENCES) ) {
		try {
			preferences = JSON.parse(File.readTextFile(PREFERENCES));
		} catch (error) {
			Console.criticalln("Retrieve preferences failed")
			Console.criticalln(error)
		}
	}
	
	// set default preferences
	if ( preferences == undefined ) {
		preferences = {
			ai_model: "",
			correction: "",
			smoothing: 0.5,
			replace_target: false,
			background: true,
			debug: false,
		}
	}
	
	return preferences
}


function getGraXpertPath() {
	// get existing path
	if ( File.exists(APP_PATH) ) {
		let path = undefined
		try {
			path = JSON.parse(File.readTextFile(APP_PATH)).path;
		} catch (error) {
			Console.criticalln("Retrieve preferences failed")
			Console.criticalln(error)
		}
		if ( path != undefined && File.exists(path) ) {
			return path
		} else {
			let mb = new MessageBox(
					"<p>Invalid path found or GraXpert App removed!</p>"+
					"<p>" + path + "</p>",
					TITLE,
					StdIcon_Error,
					StdButton_Ok
			);
			mb.execute();
		}
	}
	
	// pop-up Error did not explicitaly ask for new path
	let mb = new MessageBox(
			"<p><center>Select path to GradXtractAI (or GraXpert) first!</center></p>"+
			"<p><center><a href='" + PACKAGE_URL + "'>GradXtractAI available here</a></center></p>",
			TITLE,
			StdIcon_NoIcon,
			StdButton_Ok, StdButton_Cancel
	);
	if ( mb.execute() == StdButton_Cancel ) {
		return undefined
	}
	
	// no configuration file or invalid path
	var fd = new OpenFileDialog();
#ifeq __PI_PLATFORM__ MACOSX
	fd.caption = "Select GradXtractAI (or GraXpert) from your applications folder...";
	fd.filters = [
		 ["Apps", ".app"]
	  ];
	if (fd.execute()) {
		path = fd.fileName;
		Console.writeln("<br><b>Set application path</b>");
		Console.writeln(path.replace("\\", "/"))
		File.writeTextFile(APP_PATH, { 'path': path});
		return path;
	}
#endif
#ifeq __PI_PLATFORM__ MSWINDOWS
	fd.caption = "Select GradXtractAI (or GraXpert) from your programs folder...";
	fd.filters = [
		 ["Programs", ".exe", ".bat"]
	  ];
	if (fd.execute()) {
		let path = File.unixPathToWindows(fd.fileName);
		Console.writeln("<br><b>Set application path</b>");
		Console.writeln(path.replace("\\", "/"))
		File.writeTextFile(APP_PATH, JSON.stringify({ 'path': path}));
		return path;
	}
#else
	fd.caption = "Select GradXtractAI (or GraXpert) from your applications folder...";

	if (fd.execute()) {
		let path = fd.fileName;
		Console.writeln("<br><b>Set application path</b>");
		Console.writeln(path.replace("\\", "/"))
		File.writeTextFile(APP_PATH, { 'path': path});
		return path;
	}
#endif
	return undefined;
}

function getAIModels() {
#ifeq __PI_PLATFORM__ MACOSX
	var path = File.homeDirectory + "/Library/Application Support/GraXpert/ai-models/"
#endif
#ifeq __PI_PLATFORM__ MSWINDOWS
	var path = File.homeDirectory + "/AppData/Local/GraXpert/GraXpert/ai-models/"
#else
	Console.criticalln("FIXME: getAIModels for Linux (path to GraXpert/ai-models/ ?)")
#endif

	let ai_models = []
	let f = new FileFind;
	if ( f.begin( path + "*" ) ) do {
		if ( f.isDirectory && f.name != "." && f.name != ".." ) {
		   ai_models.push(f.name)
		}
	} while ( f.next() );
	return ai_models
}


/*
 * define a global variable containing script's parameters
 */
let GraXpertParameters = {	// stores the current parameters values into the script instance
	save: function() {
		Parameters.set("ai_model", GraXpertParameters.ai_model);
		Parameters.set("smoothing", GraXpertParameters.smoothing);
		Parameters.set("correction", GraXpertParameters.correction);
		Parameters.set("replace_target", GraXpertParameters.replace_target);
		Parameters.set("background", GraXpertParameters.background);
		Parameters.set("debug", GraXpertParameters.debug);
	},

	// loads the script instance parameters
	load: function () {
		// check AI model(s)
		let ai_models = getAIModels()
		if (ai_models.length == 0) {
			Console.criticalln("<br>GraXpert: Please, install GraXpert AI model(s) first")
			return false
		}
		
		// set parameters from Preferences
		let preferences = getPreferences()
		GraXpertParameters.ai_model = preferences.ai_model
		GraXpertParameters.correction = preferences.correction
		GraXpertParameters.smoothing = preferences.smoothing
		GraXpertParameters.replace_target = preferences.replace_target
		GraXpertParameters.background = preferences.background
		GraXpertParameters.debug = preferences.debug
		
		// load parameters
		// always check if a value with the given key exists since the parameters table
		// can be obsolete or can be modified by the user manually

		// load and check AI model
		if (Parameters.has("ai_model")) {
			let ai_model = Parameters.getString("ai_model")
			if ((ai_model != "") && (ai_models.indexOf(ai_model) == -1)) {
				Console.warningln("<br>GraXpert: Invalid AI model \"" + ai_model + "\". Select one of \"" + ai_models.join("\", \"") + "\"")
				Console.warningln("GraXpert: Default model will be used")
			} else {
				GraXpertParameters.ai_model = ai_model
			}
		}

		// load and check smoothing
		if (Parameters.has("smoothing")) {
			try {
				let smoothing = Parameters.getReal("smoothing")
				if ((smoothing == "") || (smoothing < 0) || (smoothing > 1)) {
					throw "Error value range"
				}
				GraXpertParameters.smoothing = smoothing
			} catch (error) {
				Console.warningln("<br>GraXpert: Invalid smoothing value \"" + Parameters.getString("smoothing") + "\". Select value in range [0, 1]")
				Console.warningln("GraXpert: Default smoothing will be used (" + GraXpertParameters.smoothing + ")")
			}
		}
		
		// load and check correction
		if (Parameters.has("correction")) {
			let correction = Parameters.getString("correction")
			const corrections = ["Subtraction", "Division"]
			if ((correction != "") && (corrections.indexOf(correction) == -1)) {
				Console.warningln("<br>GraXpert: Invalid correction \"" + correction + "\". Select one of \"" + corrections.join("\", \"") + "\"")
				Console.warningln("GraXpert: Default correction will be used")
			} else {
				GraXpertParameters.correction = Parameters.getString("correction")
			}
		}
		
		// load and check replace target flag
		try {
			if (Parameters.has("replace_target"))
				GraXpertParameters.replace_target = Parameters.getBoolean("replace_target")
		} catch (error) {
			Console.warningln("<br>GraXpert: Invalid replace target \"" + Parameters.getString("replace_target") + "\". Select \"true\" or \"false\"")
			Console.warningln("GraXpert: Default replace target will be used (" + GraXpertParameters.replace_target + ")")
		}
		
		// load and check background flag
		try {
			if (Parameters.has("background"))
				GraXpertParameters.background = Parameters.getBoolean("background")
		} catch (error) {
			Console.warningln("<br>GraXpert: Invalid background flag \"" + Parameters.getString("background") + "\". Select \"true\" or \"false\"")
			Console.warningln("GraXpert: Default background will be used (" + GraXpertParameters.background + ")")
		}
		
		// load and check debug flag
		try {
			if (Parameters.has("debug"))
				GraXpertParameters.debug = Parameters.getBoolean("debug")
		} catch (error) {
			Console.warningln("<br>GraXpert: Invalid debug \"" + Parameters.getString("debug") + "\". Select \"true\" or \"false\"")
			Console.warningln("GraXpert: Default debug will be used (" + GraXpertParameters.debug + ")")
		}
		
		return true

	}
}


/*
 * GraXpert engine
 */
function GraXpertEngine() {
	this.process = new ExternalProcess();

	this.progress = function(status=undefined)
	{
		processEvents();
		if ((Console.abortRequested) && (this.process.isRunning)) {
			this.process.kill()
			return
		}
		if( typeof this.progress.counter == 'undefined' ) {
			this.progress.counter = 0;
		}
		if ( status === undefined ) {
			Console.write( "<end>\b" + "-\\|/".charAt( this.progress.counter%4 ) );
			this.progress.counter++
		} else if ( status == "Completed" ) {
			Console.writeln( "<end>\b \b" + status );
			this.progress.counter = 0
		} else {
			Console.write( "<end>\b \b" );
			Console.criticalln( status );
			this.progress.counter = 0
		}
		Console.flush()
	}

	this.report = function (silent=false) {
		let errors = 0
		let lines = String(this.process.stdout).split("\r\n")
		for (let line of lines) {
		  if (line.search("ERROR") != -1) {
			  errors++
		  }
		}
		if ((!silent && errors > 0) || GraXpertParameters.debug ) {
			Console.writeln("<br><b>GraXpert output:</b> ")
			for (let line of lines) {
				if (line.length > 0) {
					if (line.search("ERROR") != -1) {
						Console.criticalln(line.replace("ERROR    ", "> "))
					} else if (line.search("WARNING") != -1) {
						Console.warningln(line.replace("WARNING  ", "> "))
					} else {
						Console.writeln(line.replace("INFO     ", "> "))
					}
				}
			}
			Console.write("<reset-font>")
		}
	}
	
	this.copyCoordinates = function(reference, result) {
		Console.writeln("<br><b>Copy coordinates:</b>")
		// Extract metadata
		var metadata0 = new ImageMetadata();
		metadata0.ExtractMetadata(reference);
		if (!metadata0.projection || !metadata0.ref_I_G) {
			Console.writeln("The reference image has no astrometric solution")
		} else {
			// Set keywords and properties
			metadata0.SaveKeywords( result, false/*beginProcess*/ );
			metadata0.SaveProperties( result, TITLE + " v" + VERSION);
		}
	}
	
	this.execute = function(targetView) {
		let graxpertPath = getGraXpertPath();
        if (graxpertPath == undefined) {
			return
		}
		
		// prepare command line
		var tmpFile = File.systemTempDirectory+"/GraXpert_input.xisf"
		var outFile = File.systemTempDirectory+"/GraXpert.xisf"
		var bkgFile = File.systemTempDirectory+"/GraXpert_background.xisf"
		var command = "\"" + graxpertPath + "\" \"" + tmpFile + "\""
		
		// disable some options and change file name/extention for compatibility
		let compatibility_mode = (graxpertPath.indexOf("GraXpert-") != -1)
		if ( compatibility_mode ) {
			var tmpFile = File.systemTempDirectory+"/Pix.fits"
			var outFile = File.systemTempDirectory+"/Pix_GraXpert.fits"
			var bkgFile = File.systemTempDirectory+"/Pix_background.fits"
			var command = "\"" + graxpertPath + "\" \"" + tmpFile + "\""
			if ( GraXpertParameters.background ) {
				Console.writeln("<br><b>GraXpert compatibility:</b> ")
				Console.warningln("** Warning: Output background not yet available in GraXpert (disabled).")
				Console.warningln("** Warning: Install and select GradXtractAI, a derivate enhanced version of GraXpert.")
				Console.warningln("** Warning: Or unchek background option in GraXpert dialog box.")
				GraXpertParameters.background = false
			}
		} else {
			var tmpFile = File.systemTempDirectory+"/Pix.xisf"
			var outFile = File.systemTempDirectory+"/GraXpert.xisf"
			var bkgFile = File.systemTempDirectory+"/GraXpert_background.xisf"
			var command = "\"" + graxpertPath + "\" \"" + tmpFile + "\" -output \"" + outFile + "\""
		}
		
		// add parameters to command line
		if ( GraXpertParameters.background ) {
			command += " -background " + bkgFile
		}
		if ( GraXpertParameters.smoothing != "" ) {
			command += " -smoothing " + GraXpertParameters.smoothing
		}
		if ( GraXpertParameters.ai_model != "" ) {
			command += " -ai_version " + GraXpertParameters.ai_model
		}
		if ( GraXpertParameters.correction != "" ) {
			command += " -correction " + GraXpertParameters.correction
		}
		
		// clean-up files
		if (File.exists(tmpFile)) File.remove(tmpFile);
		if (File.exists(outFile)) File.remove(outFile);
		if (File.exists(bkgFile)) File.remove(bkgFile);

		try {
			Console.show()
			
			// save image
			if ( !targetView.window.saveAs(tmpFile, false, false, true, false) ) {
				throw "Save error"
			}
		
			// execute GraXpert
			Console.writeln("<br><b>Run GraXpert:</b> ")
			if ( GraXpertParameters.debug ) {
				Console.warningln(command)
			}
			Console.writeln("Input:  " + tmpFile)
			Console.writeln("Output: " + outFile)
			if ( GraXpertParameters.background ) Console.writeln("Background: " + bkgFile)
			Console.writeln("AI model: " + (GraXpertParameters.ai_model == "" ? "Default" : GraXpertParameters.ai_model))
			Console.writeln("Smoothing: " + GraXpertParameters.smoothing)
			Console.writeln("Correction: " + (GraXpertParameters.correction == "" ? "Default" : GraXpertParameters.correction))
			Console.write("Status:  ")
			
			// change directory and launch command
			this.process.start(command)
			
			// enable console abort after any new start process
			Console.abortEnabled = true;
			
			// wait exit
			this.progress();
			if ( this.process.waitForStarted() )
			{
				let time_counter = 0
				this.progress()
				while ( !this.process.waitForFinished( 250 ) && this.process.isRunning ) {
					// check timeout
					if ( ++time_counter >= (4*300) ) {
						this.progress("Execute timout (" + (time_counter/4) + ")")
						throw "Process timeout"
					}
					this.progress()
				}
				this.progress();
			}
			
			// check errors
			if (this.process.error == ProcessError_FailedToStart) {
				this.progress("Process failed to start")
				throw "Command line: " + command
			}
			if (this.process.error == ProcessError_Crashed) {
				this.progress("Aborted")
				throw false
			}
			if (this.process.error == ProcessError_ReadError) {
				this.progress("Process read error")
				throw "Command line: " + command
			}
			if (this.process.error == ProcessError_UnknownError) {
				this.progress("Process unknown error")
				throw "Command line: " + command
			}
			
			// check File
			if (!File.exists( outFile )) {
				this.progress("File not found")
				throw "File " + outFile + " not found"
			}
			this.progress("Completed")
			this.report(true)
			
			// open background
			if ( GraXpertParameters.background ) {
				if (!File.exists( bkgFile )) {
					Console.warningln("Background file not found")
				} else {
					var background = ImageWindow.open(bkgFile)[0]
					if (Console.abortRequested) {
						background.forceClose();
						throw "Process aborted"
					}
				}
			}
			
			// open result
			let result = ImageWindow.open(outFile)[0]
			if (Console.abortRequested) {
				result.forceClose();
				if (background) background.forceClose();
				throw "Process aborted"
			}
			
			// process canot be aborted in last stae
			Console.abortEnabled = false;
			
			if (GraXpertParameters.replace_target) {
				// replace existing view instead of creating a new view
				targetView.beginProcess();
				targetView.image.assign( result.mainView.image );
				targetView.endProcess();
				result.forceClose();
			} else {
				// restore original fit header
				// refer https://github.com/Steffenhir/GraXpert/issues/70
				result.keywords = targetView.window.keywords
				
				// restore original metadata
				// refer https://github.com/Steffenhir/GraXpert/issues/85
				this.copyCoordinates(targetView.window, result)
			
				// show new image
				result.show()
			}
			
			// show Background
			if (background) {
				background.show()
			}
			
			// end message
			Console.noteln("\n<b>GraXpert successfully completed<\b>")
			
		} catch (error) {
			if (error) {
				Console.criticalln(error)
				this.report()
			}
		}
		
		// flush console
		Console.flush()
		
		// clean-up files
		if (File.exists(tmpFile)) File.remove(tmpFile);
		if (File.exists(outFile)) File.remove(outFile);
		if (File.exists(bkgFile)) File.remove(bkgFile);
		
	}
}


/*
 * GraXpert dialog interface
 */
function GraXpertDialog(targetView, engine) {
	this.__base__ = Dialog;
	this.__base__();
	
	this.update = function() {
		// update dialog controls
		if ( GraXpertParameters.ai_model == "" ) {
			this.selectAI_ComboBox.currentItem = 0
		} else {
			this.selectAI_ComboBox.currentItem = this.AIModels.indexOf(GraXpertParameters.ai_model)
		}
		if ( GraXpertParameters.correction == "" ) {
			this.selectCorrection_ComboBox.currentItem = 0
		} else {
			this.selectCorrection_ComboBox.currentItem = this.corrections.indexOf(GraXpertParameters.correction)
		}
		this.smoothControl.setValue(GraXpertParameters.smoothing)
		this.restoreCheckBox.checked = GraXpertParameters.replace_target;
		this.debugCheckBox.checked = GraXpertParameters.debug;
		this.backgroundCheckBox.checked = GraXpertParameters.background;
	}
	
	// set window title
	this.windowTitle = TITLE;
	
	// let the dialog to be resizable by fragging its borders
	this.userResizable = true;

	// set the minimum width of the dialog
	this.scaledMinWidth = 340;

	// create a label area
	this.title = new Label(this);
	this.title.frameStyle = FrameStyle_Box;
	this.title.minWidth = 45 * this.font.width( 'M' );
	this.title.margin = 6;
	this.title.wordWrapping = true;
	this.title.useRichText = true;
	this.title.text = "<b>" + TITLE + " v" + VERSION + "</b><br>GraXpert AI image processing."

	// create a view picker
	this.viewList = new ViewList(this);
	this.viewList.getAll();
	this.viewList.currentView = targetView
	this.viewList.onViewSelected = function (view) {
	  targetView = view;
	  if ( view && view.id )
		 this.dialog.execButton.enabled = true
	  else
		 this.dialog.execButton.enabled = false
	}

	// create smoothing control
	this.smoothControl = new NumericControl(this);
	this.smoothControl.label.text = "Smoothing:";
	this.smoothControl.label.width = 60;
	this.smoothControl.setRange(0, 1);
	this.smoothControl.slider.setRange( 0, 100 );
	this.smoothControl.setPrecision( 2 );
	this.smoothControl.toolTip = "<p>Adjust the smoothing parameter for the interpolation method.</p>";
	this.smoothControl.onValueUpdated = function( value ) {
	  GraXpertParameters.smoothing = value;
	}
	
	// reset smooth control
	this.resetSmooth = new ToolButton( this );
	this.resetSmooth.icon = this.scaledResource( ":/icons/clear-inverted.png" );
	this.resetSmooth.setScaledFixedSize( 24, 24 );
	this.resetSmooth.toolTip = "<p>Reset the Lab color blend to its default.</p>";
	this.resetSmooth.onClick = () => {
		this.smoothControl.setValue( getPreferences(true).smoothing );
	}
	
	// create a horizontal slider to layout the smooth control
	this.smoothing_Sizer = new HorizontalSizer();
	this.smoothing_Sizer.add(this.smoothControl);
	this.smoothing_Sizer.addSpacing(8);
	this.smoothing_Sizer.add(this.resetSmooth);

	// create select AI combobox
	this.AIModels = getAIModels()
	this.AIModels.unshift("Default")
	this.selectAI_Label = new Label( this );
	this.selectAI_Label.text = "AI version:";
	this.selectAI_Label.useRichText = true;
	this.selectAI_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
	this.selectAI_Label.setMaxWidth( this.font.width( this.selectAI_Label.text ) );
	this.selectAI_Label.setFixedWidth( this.font.width( this.selectAI_Label.text ) );
	this.selectAI_ComboBox = new ComboBox( this );
	this.selectAI_ComboBox.editEnabled = false
	this.selectAI_ComboBox.toolTip = "Select AI version.";
	this.AIModels.forEach((element) => this.selectAI_ComboBox.addItem(element))
	this.selectAI_ComboBox.onItemSelected = ( index ) => {
		GraXpertParameters.ai_model = ((index > 0) ? this.AIModels[index] : "")
	}
	this.selectAI_Sizer = new HorizontalSizer;
	this.selectAI_Sizer.spacing = 4;
	this.selectAI_Sizer.add( this.selectAI_Label );
	this.selectAI_Sizer.add( this.selectAI_ComboBox );
	this.selectAI_Sizer.addStretch();
	
	// create correction combobox
	this.corrections = ["Default", "Subtraction", "Division"]
	this.selectCorrection_Label = new Label( this );
	this.selectCorrection_Label.text = "Correction:";
	this.selectCorrection_Label.useRichText = true;
	this.selectCorrection_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
	this.selectCorrection_Label.setMaxWidth( this.font.width( this.selectCorrection_Label.text ) );
	this.selectCorrection_Label.setFixedWidth( this.font.width( this.selectCorrection_Label.text ) );
	this.selectCorrection_ComboBox = new ComboBox( this );
	this.selectCorrection_ComboBox.editEnabled = false
	this.selectCorrection_ComboBox.toolTip = "Correction.";
	this.corrections.forEach((element) => this.selectCorrection_ComboBox.addItem(element))
	this.selectCorrection_ComboBox.onItemSelected = ( index ) => {
		GraXpertParameters.correction = ((index > 0) ? this.corrections[index] : "")
	}
	this.selectCorrection_Sizer = new HorizontalSizer;
	this.selectCorrection_Sizer.spacing = 4;
	this.selectCorrection_Sizer.add( this.selectCorrection_Label );
	this.selectCorrection_Sizer.add( this.selectCorrection_ComboBox );
	this.selectCorrection_Sizer.addStretch();
	
	// create replace target image
	this.restoreCheckBox = new CheckBox( this );
	this.restoreCheckBox.text = "Replace target image";
	this.restoreCheckBox.toolTip = "<p>Replace target image or create a new image.</p>";
	this.restoreCheckBox.onClick = function( checked )
	{
	  GraXpertParameters.replace_target = checked;
	}
	
	// create background flag
	this.backgroundCheckBox = new CheckBox( this );
	this.backgroundCheckBox.text = "Create background model";
	this.backgroundCheckBox.toolTip = "<p>Create and open background model.</p>";
	this.backgroundCheckBox.onClick = function( checked ) {
	  GraXpertParameters.background = checked;
	}
	
	// create debug checkbox
	this.debugCheckBox = new CheckBox( this );
	this.debugCheckBox.text = "Debug GraXpert";
	this.debugCheckBox.toolTip = "<p>Activate GraXpert debug</p>";
	this.debugCheckBox.onClick = function( checked ) {
	  GraXpertParameters.debug = checked;
	}

	// Add create instance button
	this.newInstanceButton = new ToolButton( this );
	this.newInstanceButton.icon = this.scaledResource( ":/process-interface/new-instance.png" );
	this.newInstanceButton.setScaledFixedSize( 24, 24 );
	this.newInstanceButton.toolTip = "New Instance";
	this.newInstanceButton.onMousePress = () => {
	  // stores the parameters
	  GraXpertParameters.save();
	  // create the script instance
	  this.newInstance();
	};
	this.newInstanceButton.onMouseRelease = () => {
	  // close dialog
	  this.ok();
	};

	// usual control buttons
	this.execButton = new PushButton( this );
	this.execButton.text = "Execute";
	this.execButton.icon = this.scaledResource( ":/icons/ok.png" );
	if ( targetView && targetView.id )
	  this.execButton.enabled = true
	else
	  this.execButton.enabled = false
	this.execButton.onClick = () => {
		// check if a valid target view has been selected
		if (targetView && targetView.id) {
			// save preferences
			File.writeTextFile(PREFERENCES, JSON.stringify(GraXpertParameters));
			
			// close dialog
			this.ok()

			// perform GraXpert
			engine.execute(targetView);

		} else {
			// display warning
			Console.show()
			Console.warningln("No target view is specified ");
		}
	};

	// cancel
	this.cancelButton = new PushButton( this );
	this.cancelButton.text = "Cancel";
	this.cancelButton.icon = this.scaledResource( ":/icons/cancel.png" );
	this.cancelButton.onClick = function() {
		this.dialog.ok();
	};
	
	// reset
	this.setup_Reset = new ToolButton( this );
	this.setup_Reset.icon = this.scaledResource( ":/process-interface/reset.png" );
	this.setup_Reset.setScaledFixedSize( 24, 24 );
	this.setup_Reset.toolTip = "<p>Reset settings and preferences to default values.</p>";
	this.setup_Reset.onClick = () => {
		// restore default values, update dialog box and clear preferences
		GraXpertParameters = getPreferences(true)
		this.update()
		File.remove(PREFERENCES)
	};
	
	// create a horizontal slider to layout the execution button
	this.execButtonSizer = new HorizontalSizer;
	this.execButtonSizer.margin = 0;
	this.execButtonSizer.spacing = 4;
	this.execButtonSizer.add(this.newInstanceButton)
	this.execButtonSizer.addStretch();
	this.execButtonSizer.add( this.execButton );
	this.execButtonSizer.add( this.cancelButton );
	this.execButtonSizer.add( this.setup_Reset );

	// layout the dialog
	this.sizer = new VerticalSizer;
	this.sizer.margin = 8;
	this.sizer.add(this.title);
	this.sizer.addSpacing(8);
	this.sizer.add(this.viewList);
	this.sizer.addSpacing(8);
	this.sizer.add(this.selectAI_Sizer);
	this.sizer.addSpacing(8);
	this.sizer.add(this.selectCorrection_Sizer);
	this.sizer.addSpacing(8);
	this.sizer.add(this.smoothing_Sizer);
	this.sizer.addSpacing(8);
	this.sizer.add(this.restoreCheckBox);
	this.sizer.addSpacing(8);
	this.sizer.add(this.backgroundCheckBox);
	this.sizer.addSpacing(8);
	this.sizer.add(this.debugCheckBox);
	this.sizer.addSpacing(8);
	this.sizer.add(this.execButtonSizer);
	this.sizer.addStretch();
	
	// update dialog with settings
	this.update()
}

GraXpertDialog.prototype = new Dialog;

function main() {
	// prepare PiGraXpert local directory (save path and preferences)
	if ( !File.directoryExists(GRAXPERT_HOME_DIR) ) {
		Console.writeln("Create directory "+GRAXPERT_HOME_DIR)
		File.createDirectory(GRAXPERT_HOME_DIR, true)
	} else {
		Console.writeln("Directory "+GRAXPERT_HOME_DIR)
	}
	
	// script should not run in global mode
	if (Parameters.isGlobalTarget) {
	  Console.show()
	  Console.criticalln("GraXpert could not run in global context.");
	}
	Console.hide()

	// load parameters
	if (!GraXpertParameters.load()) {
		return
	}
	
	// get target view
	if (Parameters.isViewTarget) {
		var targetView = Parameters.targetView
	} else {
		var targetView = ImageWindow.activeWindow.currentView;
	}


	
	// perform the script on the target view
	let engine = new GraXpertEngine()
	if (Parameters.isViewTarget) {
          // apply process
          engine.execute(targetView);
    } else {
          // direct context, create and show the dialog
          let dialog = new GraXpertDialog(targetView, engine);
          dialog.execute();
    }

}

main();