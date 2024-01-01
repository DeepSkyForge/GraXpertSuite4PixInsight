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
// v0.0.1 12/11/23 
// - First release based on GraXpert version 2.0.2.
// v0.0.2 19/11/23 
// - Release based on enhanced Command Line Interface of GraXpert version 2.0.2.
// v0.0.3 23/11/23 
// - Extract background model by default.
// - Drag & Drop of new instance icon apply process on target image.
// - Fix error undefined ImageMetadata when create new image selected.
// - Fix undeclared variables (engine and ai_model) on first launching.
// v0.0.4 26/11/2023
// - Save custom default parameters and reset to Default
// - Automatic configurable path to GraXpert App 
// v0.0.5 03/12/2023
// - Compatibility with GraXpert and GradXtractAI.
// - Save preferences.
// v0.0.6 12/12/2023
// - Fix compatibility with MacOS (Thanks to Rob Pfile)
// - Simplify the reset path to GraXpert.
// - Log running time in Pix console.
// - Tooltip improved.
// v0.0.7 14/22/2023
// - Display GraXpert errors in console.
// - Avoid save path to temporary file.
// v0.0.8 18/12/2023
// - Integration of GraXpert pre-release v2.0.3.
// v1.0.0-beta.1 19/12/2023
// - Pre-release Beta 1
// v1.0.0-beta.2 20/12/2023
// - Add automatic version check.
// v1.0.0-beta.3 21/12/2023
// - Misc changes.
// v1.0.0 01/01/2024
// - Rework default parameters.
// - Tested with GraXpert v2.1.1
// - Fix smoothing 0.
// - User can launch UI from script.
//
// For any support or suggestion related to this script please refer to
// GitHub https://github.com/AstroDeepSky/GraXpert4PixInsight
//
// ============================================================================

#feature-id    GraXpert : Utilities > GraXpert

#feature-icon  @script_icons_dir/GraXpert.svg

#feature-info  GraXpert AI image processing.<br/>

#include <pjsr/ColorSpace.jsh>
#include <pjsr/DataType.jsh>
#include <pjsr/FrameStyle.jsh>
#include <pjsr/Sizer.jsh>
#include <pjsr/SectionBar.jsh>
#include <pjsr/NumericControl.jsh>
#include <pjsr/ProcessError.jsh>
#include <pjsr/UndoFlag.jsh>

// include required for the definition of ImageMetadata
#define SETTINGS_MODULE "GraXpert"
#include "../AdP/WCSmetadata.jsh"

#define TITLE "GraXpert script for PixInsight"

// below line will be replaced during release build from GitHub
#define VERSION "v1.0.0"

// set GraXpert folder used to store path and preferences
#ifeq __PI_PLATFORM__ MACOSX
#define GRAXPERT4PIX_HOME_DIR File.homeDirectory + "/Library/Application Support/GraXpert4PixInsight"
#define GRAXPERT_HOME_DIR File.homeDirectory + "/Library/Application Support/GraXpert"
#define GRAXPERT_AI_MODELS File.homeDirectory + "/Library/Application Support/GraXpert/ai-models/*"
#endif
#ifeq __PI_PLATFORM__ MSWINDOWS
#define GRAXPERT4PIX_HOME_DIR File.homeDirectory + "/AppData/Local/GraXpert4PixInsight"
#define GRAXPERT_HOME_DIR File.homeDirectory + "/AppData/Local/GraXpert"
#define GRAXPERT_AI_MODELS File.homeDirectory + "/AppData/Local/GraXpert/GraXpert/ai-models/*"
#endif
#ifeq __PI_PLATFORM__ LINUX
#define GRAXPERT4PIX_HOME_DIR File.homeDirectory + "/.local/share/GraXpert4PixInsight"
#define GRAXPERT_HOME_DIR File.homeDirectory + "/.local/share/GraXpert"
#define GRAXPERT_AI_MODELS File.homeDirectory + "/.local/share/GraXpert/ai-models/*"
#endif

#define GRAXPERT4PIX_URL "https://github.com/AstroDeepSky/GraXpert4PixInsight/"
#define GRAXPERT_RELEASES "https://github.com/Steffenhir/GraXpert/releases"
#define GRAXPERT4PIX_API "https://api.github.com/repos/AstroDeepSky/GraXpert4PixInsight/releases/"
#define GRAXPERT_MINIMAL_VERSION "v2.1.1"

#define GRAXPERT_PATH_CFG GRAXPERT4PIX_HOME_DIR + "/path.cfg"
#define PREFERENCES GRAXPERT4PIX_HOME_DIR + "/preferences.cfg"


/*
 * define some utils
 */
 function checkVersion() {
	// network service
	function gitHub()
	{
		this.__base__ = NetworkTransfer;
		this.__base__();
		this.data = ""

		this.onDownloadDataAvailable = function( data ) {
			this.data += data
			return true;
		};
		
		this.getReleaseInfo = function(version) {
			let url = GRAXPERT4PIX_API + version
			// Console.writeln(url)
			this.setURL( url );
			this.data = ""
			this.download()
			var response = JSON.parse(this.data)
			this.data = ""
			return response
		}
	}
	gitHub.prototype = new NetworkTransfer;
	
	Console.writeln("<br><b>Checking version:</b> ")
	 
	// check version
	try {
		let git = new gitHub();
		let latestRelease = git.getReleaseInfo("latest")
		let currentRelease = git.getReleaseInfo("tags/"+VERSION)
		if ( currentRelease.hasOwnProperty("message") && currentRelease["message"] == "Not Found" ) {
			Console.warningln(TITLE + " version " + VERSION + " (Not yet published)")
		} else if ( latestRelease["published_at"] > currentRelease["published_at"] ) {
			Console.warningln("New release "+latestRelease["tag_name"]+" available on GitHub")
			Console.warningln("Visit "+GRAXPERT4PIX_URL)
			Console.warningln("Download "+GRAXPERT4PIX_URL+"releases/download/"+VERSION+"/GraXpert.js")
		} else {
			Console.writeln(TITLE + " version " + VERSION + " ("+currentRelease["published_at"].substring(0, 16).replace("T"," ")+")")
		}
	}
	catch (error) {
		Console.writeln("Check latest version failed (Check your internet connection)")
		if ( !error.message.contains("JSON.parse") ) Console.writeln(error)
	}
	
	// alert user in case of Beta version
	if ( VERSION.toLowerCase().search("beta") != -1 ) {
		Console.show()
		Console.warningln("Please note you are using a Beta version!")
		Console.warningln("THIS VERSION REQUIRES GraXpert " + GRAXPERT_MINIMAL_VERSION + " OR HIGHER.")
		Console.warningln("THIS VERSION IS NOT COMPATIBLE WITH GraXpert v2.0.2.")
	}
}
 
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
		let ai_models = getAIModels()
		preferences = {
			ai_model: (ai_models.length > 0 ? ai_models[0] : ""),
			correction: "Subtraction",
			smoothing: 0, // 0 is the recommended value when AI is used.
			replace_target: false,
			background: true,
			debug: false,
		}
	} else {
		// manage compatibilities with old versions
		if ( preferences["correction"] == "" ) {
			preferences["correction"] = "Subtraction"
		}
	}
	
	return preferences
}


function setGraXpertPath() {
	// no configuration file or invalid path
	var fd = new OpenFileDialog();
#ifeq __PI_PLATFORM__ MACOSX
	fd.caption = "Select GraXpert from your applications folder...";
	fd.filters = [
		 ["Apps", ".app"]
	  ];
	if (fd.execute()) {
		let path = fd.fileName;
		Console.writeln("<br><b>Set GraXpert path:</b>");
		Console.writeln(path.replace("\\", "/"))
		File.writeTextFile(GRAXPERT_PATH_CFG, JSON.stringify({ 'path': path}));
		return path;
	}
#endif
#ifeq __PI_PLATFORM__ MSWINDOWS
	fd.caption = "Select GraXpert from your programs folder...";
	fd.filters = [
		 ["Programs", ".exe", ".bat"]
	  ];
	if (fd.execute()) {
		let path = File.unixPathToWindows(fd.fileName);
		Console.writeln("<br><b>Set GraXpert path:</b>");
		Console.writeln(path.replace("\\", "/"))
		File.writeTextFile(GRAXPERT_PATH_CFG, JSON.stringify({ 'path': path}));
		return path;
	}
#else
	fd.caption = "Select GraXpert from your applications folder...";

	if (fd.execute()) {
		let path = fd.fileName;
		Console.writeln("<br><b>Set GraXpert path:</b>");
		Console.writeln(path.replace("\\", "/"))
		File.writeTextFile(GRAXPERT_PATH_CFG, JSON.stringify({ 'path': path}));
		return path;
	}
#endif
	return undefined;
}


function getGraXpertPath(ask = true) {
	// get existing path
	if ( File.exists(GRAXPERT_PATH_CFG) ) {
		let path = undefined
		try {
			path = JSON.parse(File.readTextFile(GRAXPERT_PATH_CFG)).path;
		} catch (error) {
			Console.criticalln("Retrieve preferences failed")
			Console.criticalln(error)
		}
		if ( path != undefined && File.exists(path) ) {
			return path
		}
	}
	
	if ( !ask ) {
		return undefined
	}
	
	// pop-up error and ask for new path
	let mb = new MessageBox(
			"<p><center>Select path to GraXpert first!<br>"+
			"(GraXpert " + GRAXPERT_MINIMAL_VERSION + " or higher required)</center></p>"+
			"<p><center><a href='" + GRAXPERT_RELEASES + "'>GraXpert available here</a></center></p>",
			TITLE,
			StdIcon_NoIcon,
			StdButton_Ok, StdButton_Cancel
	);
	if ( mb.execute() == StdButton_Cancel ) {
		return undefined
	}
	
	// set GraXpert path
	return setGraXpertPath()
}

function getAIModels() {
	let ai_models = []
	let f = new FileFind;
	if ( f.begin( GRAXPERT_AI_MODELS ) ) do {
		if ( f.isDirectory && f.name != "." && f.name != ".." ) {
		   ai_models.push(f.name)
		}
	} while ( f.next() );
	return ai_models.sort().reverse();
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
		// log GraXpert script version
		Console.writeln("<br><b>Loading parameters:</b> ")
		let errors = 0
		
		// set parameters from Preferences
		let preferences = getPreferences()
		GraXpertParameters.ai_model = preferences.ai_model
		GraXpertParameters.correction = preferences.correction
		GraXpertParameters.smoothing = preferences.smoothing
		GraXpertParameters.replace_target = preferences.replace_target
		GraXpertParameters.background = preferences.background
		GraXpertParameters.debug = preferences.debug
		
		// check local  AI model(s)
		let ai_models = getAIModels()
		if (ai_models.length == 0) {
			Console.warningln("GraXpert AI model(s) not yet installed.")
			Console.warningln("Default model will be downloaded and used.")
			errors++
			let mb = new MessageBox(
				"<p><center>GraXpert AI model(s) not yet installed !</center></p>"+
				"<p><center>The first execution will installe the default model.<br>"+
				"This may delay processing of first image by several minutes.</center></p>"+
				"<p><center><a href='" + GRAXPERT4PIX_URL + "'>Visit GitHub GraXpert script for PixInsight</a></center></p>",
				TITLE,
				StdIcon_NoIcon,
				StdButton_Ok
			);
			mb.execute()
			// reset AI model to continue
			GraXpertParameters.ai_model = ""
		} else if ((GraXpertParameters.ai_model != "") && (ai_models.indexOf(GraXpertParameters.ai_model) == -1)) {
			errors++
			Console.warningln("AI model \"" + GraXpertParameters.ai_model + "\" no more stored locally.")
			GraXpertParameters.ai_model = ai_models[0]
			Console.warningln("Default model \"" + GraXpertParameters.ai_model + "\" will be used.")
		} else if (GraXpertParameters.ai_model == "") {
			// force last AI model (first in the list)
			GraXpertParameters.ai_model = ai_models[0]
		}
			
		
		// load parameters
		// always check if a value with the given key exists since the parameters table
		// can be obsolete or can be modified by the user manually

		// load and check AI model
		if (Parameters.has("ai_model")) {
			let ai_model = Parameters.getString("ai_model")
			if ( ai_models.length == 0 ) {
				GraXpertParameters.ai_model = ""
			} else if ((ai_model != "") && (ai_models.indexOf(ai_model) == -1)) {
				errors++
				Console.warningln("AI model \"" + ai_model + "\" no more stored locally.")
				GraXpertParameters.ai_model = ai_models[0]
				Console.warningln("Default model \"" + GraXpertParameters.ai_model + "\" will be used.")
			} else if (ai_model == "") {
				GraXpertParameters.ai_model = ai_models[0]
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
				Console.warningln("Invalid smoothing value \"" + Parameters.getString("smoothing") + "\". Select value in range [0, 1]")
				Console.warningln("Default smoothing will be used (" + GraXpertParameters.smoothing + ")")
				errors++
			}
		}
		
		// load and check correction
		if (Parameters.has("correction")) {
			let correction = (Parameters.getString("correction") == "" ? "Subtraction" : Parameters.getString("correction"))
			const corrections = ["Subtraction", "Division"]
			if ((correction != "") && (corrections.indexOf(correction) == -1)) {
				Console.warningln("Invalid correction \"" + correction + "\". Select one of \"" + corrections.join("\", \"") + "\"")
				Console.warningln("Default correction will be used")
				GraXpertParameters.correction = "Subtraction"
				errors++
			} else {
				GraXpertParameters.correction = Parameters.getString("correction")
			}
		}
		
		// load and check replace target flag
		try {
			if (Parameters.has("replace_target"))
				GraXpertParameters.replace_target = Parameters.getBoolean("replace_target")
		} catch (error) {
			Console.warningln("Invalid replace target \"" + Parameters.getString("replace_target") + "\". Select \"true\" or \"false\"")
			Console.warningln("Default replace target will be used (" + GraXpertParameters.replace_target + ")")
			errors++
		}
		
		// load and check background flag
		try {
			if (Parameters.has("background"))
				GraXpertParameters.background = Parameters.getBoolean("background")
		} catch (error) {
			Console.warningln("Invalid background flag \"" + Parameters.getString("background") + "\". Select \"true\" or \"false\"")
			Console.warningln("Default background will be used (" + GraXpertParameters.background + ")")
			errors++
		}
		
		// load and check debug flag
		try {
			if (Parameters.has("debug"))
				GraXpertParameters.debug = Parameters.getBoolean("debug")
		} catch (error) {
			Console.warningln("Invalid debug \"" + Parameters.getString("debug") + "\". Select \"true\" or \"false\"")
			Console.warningln("Default debug will be used (" + GraXpertParameters.debug + ")")
			errors++
		}
		
		if ( errors == 0 ) {
			Console.writeln("Parameters Ok")
		} else {
			Console.writeln("Check completed")
		}
		
		return true

	}
}


/*
 * GraXpert engine
 */
function GraXpertEngine() {
	this.process = new ExternalProcess();

	this.progress = function (status=undefined)
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
	
	this.filterLogs = function (line) {
		let filter = [
			"Unsupported Property type F64Vector",
			"Unsupported Property type F64Matrix",
			"Unsupported Property type F64Vector",
			"Unsupported Property type F64Vector",
			"Unsupported Property type F64Vector",
			"Unsupported Property type UI8Vector",
			"you can change this by providing the argument '-ai_version'"]
		
		for (var msg of filter) {
			if ( line.contains(msg) ) return true
		}
		return false
	}

	this.report = function (silent=false) {
		let errors = 0
		let counter = 0
		let error_args = false
		let lines = String(this.process.stdout).split("\r\n")
		for (let line of lines) {
			if (line.length > 0) {
				counter ++
			}
			if (line.toLowerCase().search("error") != -1) {
				errors++
			}
			if (line.toLowerCase().search("unrecognized arguments") != -1) {
				error_args = true
			}
		}
		if (counter > 0 && (!silent || errors > 0 || GraXpertParameters.debug )) {
			Console.writeln("<br><b>GraXpert logs:</b> ")
			for (var line of lines) {
				if (line.length == 0) {
					continue
				}
				if (this.filterLogs(line)) {
					// filter disabled
					// continue
				}
				if (line.toLowerCase().search("error") != -1) {
					Console.criticalln(line)
				} else if (line.toLowerCase().search("warning") != -1) {
					Console.warningln(line)
				} else {
					Console.writeln(line)
				}
			}
			if ( error_args ) {
				Console.criticalln("<br>Please ensure you have GraXpert version 2.1.1 or higher")
			}
			Console.write("<reset-font>")
		}
	}
	
	this.copyCoordinates = function (reference, result) {
		Console.writeln("<br><b>Copy coordinates:</b>")
		// Extract metadata
		var metadata0 = new ImageMetadata();
		metadata0.ExtractMetadata(reference);
		if (!metadata0.projection || !metadata0.ref_I_G) {
			Console.writeln("The reference image has no astrometric solution")
		} else {
			// Set keywords and properties
			metadata0.SaveKeywords( result, false/*beginProcess*/ );
			metadata0.SaveProperties( result, TITLE + " " + VERSION);
		}
	}
	
	this.clone = function (targetView, Id) {
		var img = targetView.mainView.image
		var cloneImageWindow = new ImageWindow(
			img.width,
			img.height,
			img.numberOfChannels,
			32,
			true,
			img.colorSpace != ColorSpace_Gray,
			Id
		);

		cloneImageWindow.mainView.beginProcess(UndoFlag_NoSwapFile);
		cloneImageWindow.mainView.image.apply(img);
		cloneImageWindow.mainView.endProcess();
		
		targetView.forceClose();
		
		return cloneImageWindow
	}
	
	this.execute = function(targetView) {
		// return if GraXpert path not yet defined
		let graxpertPath = getGraXpertPath();
		if (graxpertPath == undefined) {
			return
		}
		
		// set files and command line
		var tmpFile = File.systemTempDirectory+"/Pix.xisf"
		var outFile = File.systemTempDirectory+"/Pix_GraXpert.xisf"
		var bkgFile = File.systemTempDirectory+"/Pix_GraXpert_background.xisf"
		var command = "\"" + graxpertPath + "\" \"" + tmpFile + "\" -cli"
		
		// add parameters to command line
		if ( GraXpertParameters.background ) {
			command += " -bg"
		}
		if ( GraXpertParameters.smoothing !== "" ) {
			command += " -smoothing " + GraXpertParameters.smoothing
		}
		if ( GraXpertParameters.ai_model !== "" ) {
			command += " -ai_version " + GraXpertParameters.ai_model
		}
		if ( GraXpertParameters.correction !== "" ) {
			command += " -correction " + GraXpertParameters.correction
		}
		
		// clean-up files
		if (File.exists(tmpFile)) File.remove(tmpFile);
		if (File.exists(outFile)) File.remove(outFile);
		if (File.exists(bkgFile)) File.remove(bkgFile);
		
		try {
			Console.show()
			
			// save image
			let clonedView = new View(targetView);
			if ( !clonedView.window.saveAs(tmpFile, false, false, true, false) ) {
				throw "Save error"
			}
		
			// execute GraXpert
			Console.writeln("<br><b>Run GraXpert:</b> ")
			Console.writeln("Exec: " + graxpertPath)
			Console.writeln("Input:  " + tmpFile)
			Console.writeln("Output: " + outFile)
			if ( GraXpertParameters.background ) Console.writeln("Background: " + bkgFile)
			Console.writeln("AI model: " + (GraXpertParameters.ai_model == "" ? "Default" : GraXpertParameters.ai_model))
			Console.writeln("Smoothing: " + GraXpertParameters.smoothing)
			Console.writeln("Correction: " + (GraXpertParameters.correction == "" ? "Default" : GraXpertParameters.correction))
			if ( GraXpertParameters.debug ) {
				Console.writeln("Command line: "+command)
			}
			if ( getAIModels().length == 0 ) {
				Console.warningln("GraXpert will download default AI model, this may take several minutes.")
			}
			Console.write("Status:  ")
			
			// start time measure
			let execTime = Date.now()
			
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
			
			// measure time
			execTime = Math.floor( (Date.now() - execTime) / 1000 )
			this.progress("Completed")
			Console.writeln("Running time: " + execTime + " seconds")
			this.report(true)
			
			// open background
			if ( GraXpertParameters.background ) {
				if (!File.exists( bkgFile )) {
					Console.warningln("Background file not found")
					Console.warningln("Please ensure you have last version of GraXpert")
				} else {
					var background = ImageWindow.open(bkgFile)[0]
					if (Console.abortRequested) {
						background.forceClose();
						throw "Process aborted"
					}
				}
			}
			
			// open result
			let result = ImageWindow.open(outFile, '', '', true)[0]
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
				// clone result into new ImageWindow
				result = this.clone(result, "GraXpert")
				
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
				background = this.clone(background, "GraXpert_background")
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
	
	this.updateButtons = function() {
		// update dialog controls
		if ( this.selectAI_Sizer ) {
			this.selectAI_ComboBox.currentItem = this.AIModels.indexOf(GraXpertParameters.ai_model)
		}
		if ( GraXpertParameters.correction == "" ) {
			this.selectCorrection_ComboBox.currentItem = 0
		} else {
			this.selectCorrection_ComboBox.currentItem = this.corrections.indexOf(GraXpertParameters.correction)
		}
		this.smoothControl.setValue(GraXpertParameters.smoothing)
		this.createImageCheckBox.checked = !GraXpertParameters.replace_target;
		this.debugCheckBox.checked = GraXpertParameters.debug;
		if ( this.backgroundCheckBox ) {
			this.backgroundCheckBox.checked = GraXpertParameters.background;
		}
	}
	
	this.updatePathIcon = function() {
		if ( getGraXpertPath(false) == undefined ) {
			this.pathButton.icon = this.scaledResource( ":/icons/process-error.png" );
		} else {
			this.pathButton.icon = this.scaledResource( ":/icons/process-ok.png" );
		}
	}
	
	this.toggleSectionHandler = function ( section, toggleBegin ) {
		if ( !toggleBegin )
		{
			section.dialog.setVariableHeight();
			section.dialog.adjustToContents();
			section.dialog.setFixedHeight();
		}
	}
	
	// set window title
	this.windowTitle = TITLE;
	
	// let the dialog to be resizable by fragging its borders
	this.userResizable = true;

	// set the minimum width of the dialog
	this.scaledMinWidth = 430;
	this.scaledMaxWidth = 430;

	// create a label area
	this.title = new Label(this);
	this.title.frameStyle = FrameStyle_Box;
	this.title.minWidth = 46 * this.font.width( 'M' );
	this.title.margin = 6;
	this.title.wordWrapping = true;
	this.title.useRichText = true;
	this.title.text = "<b>" + TITLE + " version " + VERSION + "</b><br>GraXpert is an astronomical image processing program for extracting and removing gradients from the background of your astrophotos.<br><a href='" + GRAXPERT4PIX_URL + "'>Visit GitHub GraXpert for pixinsight</a>"

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
	this.smoothControl.setPrecision( 3 );
	this.smoothControl.toolTip = "<p>Adjust the strength of smoothing, ranging from 0.0 (no smoothing) to 1 (maximum smoothing).</p>";
	this.smoothControl.onValueUpdated = function( value ) {
		GraXpertParameters.smoothing = value;
	}
	
	// reset smooth control
	this.resetSmooth = new ToolButton( this );
	this.resetSmooth.icon = this.scaledResource( ":/icons/clear-inverted.png" );
	this.resetSmooth.setScaledFixedSize( 24, 24 );
	this.resetSmooth.toolTip = "<p>Reset the Lab color blend to its default.</p>";
	this.resetSmooth.onClick = () => {
		GraXpertParameters.smoothing = getPreferences(true).smoothing
		this.smoothControl.setValue( GraXpertParameters.smoothing );
		
	}
	
	// create a horizontal slider to layout the smooth control
	this.smoothing_Sizer = new HorizontalSizer();
	this.smoothing_Sizer.add(this.smoothControl);
	this.smoothing_Sizer.addSpacing(8);
	this.smoothing_Sizer.add(this.resetSmooth);

	// create correction combobox
	this.corrections = ["Subtraction", "Division"]
	this.selectCorrection_Label = new Label( this );
	this.selectCorrection_Label.text = "Correction:";
	this.selectCorrection_Label.useRichText = true;
	this.selectCorrection_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
	this.selectCorrection_Label.setMaxWidth( this.font.width( this.selectCorrection_Label.text ) );
	this.selectCorrection_Label.setFixedWidth( this.font.width( this.selectCorrection_Label.text ) );
	this.selectCorrection_ComboBox = new ComboBox( this );
	this.selectCorrection_ComboBox.editEnabled = false
	this.selectCorrection_ComboBox.toolTip = "<p>Select the background correction method. Options are \"Subtraction\" (default) or \"Division\".</p>";
	this.corrections.forEach((element) => this.selectCorrection_ComboBox.addItem(element))
	this.selectCorrection_ComboBox.onItemSelected = ( index ) => {
		GraXpertParameters.correction = this.corrections[index]
	}
	this.selectCorrection_Sizer = new HorizontalSizer;
	this.selectCorrection_Sizer.spacing = 4;
	this.selectCorrection_Sizer.add( this.selectCorrection_Label );
	this.selectCorrection_Sizer.add( this.selectCorrection_ComboBox );
	this.selectCorrection_Sizer.addStretch();
	
	// create replace target image
	this.createImageCheckBox = new CheckBox( this );
	this.createImageCheckBox.text = "Create new image";
	this.createImageCheckBox.toolTip = "<p>Create new image or replace target image.</p>";
	this.createImageCheckBox.onClick = function( checked ) {
		GraXpertParameters.replace_target = !checked;
	}
	
	// create background checkbox
	this.backgroundCheckBox = new CheckBox( this );
	this.backgroundCheckBox.text = "Create background model";
	this.backgroundCheckBox.toolTip = "<p>Create and open background model.</p>";
	this.backgroundCheckBox.onClick = function( checked ) {
	  GraXpertParameters.background = checked;
	}
	
	// create select AI combobox when several models locally installed
	this.selectAI_Sizer = false
	this.AIModels = getAIModels()
	if ( this.AIModels.length > 0 ) {
		this.selectAI_Label = new Label( this );
		this.selectAI_Label.text = "AI version:";
		this.selectAI_Label.useRichText = true;
		this.selectAI_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
		this.selectAI_Label.setMaxWidth( this.font.width( this.selectAI_Label.text ) );
		this.selectAI_Label.setFixedWidth( this.font.width( this.selectAI_Label.text ) );
		this.selectAI_ComboBox = new ComboBox( this );
		this.selectAI_ComboBox.editEnabled = false
		this.selectAI_ComboBox.toolTip = "<p>Specify the version of the AI model to use. "+
										 "If not provided, it defaults to the latest available version. "+
										 "You can choose only locally available AI models. "+
										 "Run GraXpert UI to download additional AI models.</p>";
		this.AIModels.forEach((element) => this.selectAI_ComboBox.addItem(element))
		this.selectAI_ComboBox.onItemSelected = ( index ) => {
			GraXpertParameters.ai_model = this.AIModels[index]
		}
		this.selectAI_Sizer = new HorizontalSizer;
		this.selectAI_Sizer.spacing = 4;
		this.selectAI_Sizer.add( this.selectAI_Label );
		this.selectAI_Sizer.add( this.selectAI_ComboBox );
		this.selectAI_Sizer.addStretch();
	}
	
	// create debug checkbox
	this.debugCheckBox = new CheckBox( this );
	this.debugCheckBox.text = "Debug GraXpert";
	this.debugCheckBox.toolTip = "<p>Activate GraXpert debug</p>";
	this.debugCheckBox.onClick = function( checked ) {
	  GraXpertParameters.debug = checked;
	}
	
	// run UI button
	this.LaunchButton = new ToolButton( this );
	this.LaunchButton.setScaledFixedSize( 24, 16 );
	this.LaunchButton.icon = this.scaledResource( ":/icons/screen.png" );
	this.LaunchButton.toolTip = "<p>Launch GraXpert UI.</p>";
	this.LaunchButton.onClick = () => {
		let graxpertPath = getGraXpertPath();
		this.updatePathIcon()
		if (graxpertPath != undefined) {
			// launch UI and close dialog box
			Console.writeln("Launching GraXpert UI.")
			ExternalProcess.startDetached("\"" + graxpertPath + "\"")
			this.ok()
		}
	}
	this.Launch_Label = new Label( this );
	this.Launch_Label.text = "Launch UI";
	this.Launch_Label.useRichText = true;
	this.Launch_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
	this.Launch_Label.setMaxWidth( this.font.width( this.Launch_Label.text ) );
	this.Launch_Label.setFixedWidth( this.font.width( this.Launch_Label.text ) )

	// select GraXpert path
	this.pathButton = new ToolButton( this );
	this.updatePathIcon()
	this.pathButton.setScaledFixedSize( 24, 16 );
	this.pathButton.toolTip = "<p>Setup the path to GraXpert.</p>";
	this.pathButton.onClick = () => {
		setGraXpertPath();
		this.updatePathIcon()
	}
	this.pathButton_Label = new Label( this );
	this.pathButton_Label.text = "Set path";
	this.pathButton_Label.useRichText = true;
	this.pathButton_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
	this.pathButton_Label.setMaxWidth( this.font.width( this.pathButton_Label.text ) );
	this.pathButton_Label.setFixedWidth( this.font.width( this.pathButton_Label.text ) );
	this.pathButton_Sizer = new HorizontalSizer;
	this.pathButton_Sizer.spacing = 3;
	this.pathButton_Sizer.add( this.debugCheckBox );
	this.pathButton_Sizer.addStretch();
	this.pathButton_Sizer.add( this.pathButton_Label );
	this.pathButton_Sizer.add( this.pathButton );
	this.pathButton_Sizer.addStretch();
	this.pathButton_Sizer.add( this.Launch_Label );
	this.pathButton_Sizer.add( this.LaunchButton );
	
	// advanced section
	this.target_Section = new SectionBar( this, "Advanced Parameters" );
	this.target_Control = new Control( this );
	this.target_Section.setSection( this.target_Control );
	this.target_Section.onToggleSection = this.toggleSectionHandler;
	this.target_Control.sizer = new VerticalSizer;
	this.target_Control.sizer.scaledSpacing = 8;
	this.target_Control.sizer.add( this.pathButton_Sizer );
	if ( this.selectAI_Sizer ) this.target_Control.sizer.add(this.selectAI_Sizer);
	
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

	// execute
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
	
	// reset parameters
	this.resetButton = new ToolButton( this );
	this.resetButton.icon = this.scaledResource( ":/process-interface/reset.png" );
	this.resetButton.setScaledFixedSize( 24, 24 );
	this.resetButton.toolTip = "<p>Reset settings and preferences to default values.</p>";
	this.resetButton.onClick = () => {
		// restore default values, update dialog box and clear preferences
		GraXpertParameters = getPreferences(true)
		this.updateButtons()
		if ( File.exists(PREFERENCES) ) {
			File.remove(PREFERENCES)
		}
	};
	
	// create a horizontal slider to layout the execution button
	this.execButtonSizer = new HorizontalSizer;
	this.execButtonSizer.margin = 0;
	this.execButtonSizer.spacing = 4;
	this.execButtonSizer.add(this.newInstanceButton)
	this.execButtonSizer.addStretch();
	this.execButtonSizer.add( this.execButton );
	this.execButtonSizer.add( this.cancelButton );
	this.execButtonSizer.add( this.resetButton );
	
	// layout the dialog
	this.sizer = new VerticalSizer;
	this.sizer.margin = 8;
	this.sizer.add(this.title);
	this.sizer.addSpacing(8);
	this.sizer.add(this.viewList);
	this.sizer.addSpacing(8);
	this.sizer.addSpacing(8);
	this.sizer.add(this.selectCorrection_Sizer);
	this.sizer.addSpacing(8);
	this.sizer.add(this.smoothing_Sizer);
	this.sizer.addSpacing(8);
	this.sizer.add(this.createImageCheckBox);
	if ( this.backgroundCheckBox ) {
		this.sizer.addSpacing(8);
		this.sizer.add(this.backgroundCheckBox);
	}
	this.sizer.addSpacing(16);
	this.sizer.add(this.target_Section)
	this.sizer.addSpacing(8);
	this.sizer.add(this.target_Control);
	this.sizer.addSpacing(8);
	this.sizer.add(this.execButtonSizer);
	this.sizer.addStretch();
	
	// update dialog with settings
	this.updateButtons()
	
	// set dialog height
	this.setVariableHeight();
	this.adjustToContents();
	this.setFixedHeight();
}

GraXpertDialog.prototype = new Dialog;


function main() {
	// script should not run in global mode
	if (Parameters.isGlobalTarget) {
		Console.show()
		Console.criticalln("GraXpert could not run in global context.");
	}
	Console.hide()
	
	// get target view
	if (Parameters.isViewTarget) {
		var targetView = Parameters.targetView
	} else {
		var targetView = ImageWindow.activeWindow.currentView;
	}
	
	// check if view available
	if ( !targetView || !targetView.id ) {
		// pop-up alert
		let mb = new MessageBox(
				"<p><center>No view available to execute GraXpert.</center></p>"+
				"<p><center>Click Ok to continue.</center></p>",
				TITLE,
				StdIcon_NoIcon,
				StdButton_Ok
		);
		mb.execute()
		Console.writeln("<br><b>Checking context:</b> ")
		Console.warningln("No view available to run GraXpert.")
	}

	// prepare PiGraXpert local directory (save path and preferences)
	if ( !File.directoryExists(GRAXPERT4PIX_HOME_DIR) ) {
		Console.writeln("Create directory "+GRAXPERT4PIX_HOME_DIR)
		File.createDirectory(GRAXPERT4PIX_HOME_DIR, true)
	}
	
	// check version
	checkVersion()

	// load parameters
	if (!GraXpertParameters.load()) {
		return
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
