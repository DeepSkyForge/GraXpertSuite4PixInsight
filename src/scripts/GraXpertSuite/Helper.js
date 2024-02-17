// ----------------------------------------------------------------------------
// GraXpert Suite for PixInsight (JavaScript Runtime)
// ----------------------------------------------------------------------------
//
// Helper.js part of GraXpert Suite for PixInsight
// Copyright (c) 2024 Joël Vallier (joel.vallier@gmail.com)
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

#ifndef __GRAXPERT_HELPER_jsh
#define __GRAXPERT_HELPER_jsh

#include <pjsr/ColorSpace.jsh>
#include <pjsr/DataType.jsh>
#include <pjsr/FrameStyle.jsh>
#include <pjsr/Sizer.jsh>
#include <pjsr/SectionBar.jsh>
#include <pjsr/NumericControl.jsh>
#include <pjsr/ProcessError.jsh>
#include <pjsr/UndoFlag.jsh>

// below line will be replaced during release build from GitHub
#define VERSION "v1.3.0"

// set GraXpert folder used to store path and preferences
#ifeq __PI_PLATFORM__ MACOSX
#define GRAXPERT4PIX_HOME_DIR File.homeDirectory + "/Library/Application Support/GraXpert4PixInsight"
#define GRAXPERT_PREFERENCES File.homeDirectory + "/Library/Application Support/GraXpert/GraXpert/preferences.json"
#define GRAXPERT_AI_MODELS File.homeDirectory + "/Library/Application Support/GraXpert/ai-models/*"
#endif
#ifeq __PI_PLATFORM__ MSWINDOWS
#define GRAXPERT4PIX_HOME_DIR File.homeDirectory + "/AppData/Local/GraXpert4PixInsight"
#define GRAXPERT_PREFERENCES File.homeDirectory + "/AppData/Local/GraXpert/GraXpert/preferences.json"
#define GRAXPERT_AI_MODELS File.homeDirectory + "/AppData/Local/GraXpert/GraXpert/ai-models/*"
#endif
#ifeq __PI_PLATFORM__ LINUX
#define GRAXPERT4PIX_HOME_DIR File.homeDirectory + "/.local/share/GraXpert4PixInsight"
#define GRAXPERT_PREFERENCES File.homeDirectory + "/.local/share/GraXpert/GraXpert/preferences.json"
#define GRAXPERT_AI_MODELS File.homeDirectory + "/.local/share/GraXpert/ai-models/*"
#endif

#define DEEPSKYFORGE "https://www.deepskyforge.com/"
#define GRAXPERT_RELEASES "https://github.com/Steffenhir/GraXpert/releases/"
#define GRAXPERT_MINIMAL_VERSION "v2.2.1"

#define GRAXPERT_PATH_CFG GRAXPERT4PIX_HOME_DIR + "/path.cfg"
#define PREFERENCES GRAXPERT4PIX_HOME_DIR + "/preferences.cfg"

#define DEFAULT_AUTOSTRETCH_SCLIP  -2.80
#define DEFAULT_AUTOSTRETCH_TBGND   0.25

/*
 * define a global variable containing script's parameters
 */
let GraXpert4PixParams = {
	defaults: function() {
		// return default parameters
		let ai_models = GraXpert4PixParams.getAIModels();
		return {
			ai_model: (ai_models.length > 0 ? ai_models[0] : ""),
			correction: "Subtraction",
			smoothing: 0.0, // 0 is the recommended value when AI is used.
			replace_target: false,
			background: true,
			debug: false,
		};
	},
	
	_loadPreferences: function() {
		let preferences = undefined;
		
		if ( File.exists(PREFERENCES) ) {
			try {
				// get preferences from file
				preferences = JSON.parse(File.readTextFile(PREFERENCES));
				
				// manage compatibilities with old versions
				if ( preferences["correction"] == "" ) {
					preferences["correction"] = "Subtraction";
				};
			} catch (error) {
				Console.criticalln("Retrieve preferences failed");
				Console.criticalln(error);
			};
		};
		
		// set default preferences
		let defaults = GraXpert4PixParams.defaults();
		if ( preferences == undefined ) {
			preferences = defaults;
		};
		
		// use preferences or defaults
		GraXpert4PixParams.ai_model 		= preferences.ai_model || defaults.ai_model;
		GraXpert4PixParams.correction 		= preferences.correction || defaults.correction;
		GraXpert4PixParams.smoothing 		= preferences.smoothing || defaults.smoothing;
		GraXpert4PixParams.replace_target 	= preferences.replace_target || defaults.replace_target;
		GraXpert4PixParams.background 		= preferences.background || defaults.background;
		GraXpert4PixParams.debug 			= preferences.debug || defaults.debug;
	},
	
	// loads the script instance parameters
	init: function () {
		// log GraXpert script version
		Console.writeln("<br><b>Loading parameters:</b> ");
		Console.writeln("GraXpert Suite "+VERSION);
		let errors = 0;
		
		// prepare local directory (save path and preferences)
		if ( !File.directoryExists(GRAXPERT4PIX_HOME_DIR) ) {
			Console.writeln("Create directory "+GRAXPERT4PIX_HOME_DIR);
			File.createDirectory(GRAXPERT4PIX_HOME_DIR, true);
		};
		
		// set parameters from Preferences
		GraXpert4PixParams._loadPreferences();
		
		// check local AI model(s)
		let ai_models = GraXpert4PixParams.getAIModels();
		if (ai_models.length == 0) {
			Console.warningln("GraXpert AI model(s) not yet installed.");
			Console.warningln("Default model will be downloaded and used.");
			errors++;
			// reset AI model to continue
			GraXpert4PixParams.ai_model = "";
		} else if ((GraXpert4PixParams.ai_model != "") && (ai_models.indexOf(GraXpert4PixParams.ai_model) == -1)) {
			errors++;
			Console.warningln("AI model \"" + GraXpert4PixParams.ai_model + "\" no more stored locally.");
			GraXpert4PixParams.ai_model = ai_models[0];
			Console.warningln("Default model \"" + GraXpert4PixParams.ai_model + "\" will be used.");
		} else if (GraXpert4PixParams.ai_model == "") {
			// force last AI model (first in the list)
			GraXpert4PixParams.ai_model = ai_models[0];
		};
			
		// load Parameters
		errors += GraXpert4PixParams._loadParameters();
		
		if ( errors == 0 ) {
			Console.writeln("Parameters Ok");
		} else {
			Console.writeln("Check completed");
		}
		
		return true;

	},
	
	save: function() {
		Parameters.set("ai_model", GraXpert4PixParams.ai_model);
		Parameters.set("smoothing", GraXpert4PixParams.smoothing);
		Parameters.set("correction", GraXpert4PixParams.correction);
		Parameters.set("replace_target", GraXpert4PixParams.replace_target);
		Parameters.set("background", GraXpert4PixParams.background);
		Parameters.set("debug", GraXpert4PixParams.debug);
	},

	reset: function() {
		// delete references
		if ( File.exists(PREFERENCES) ) {
			File.remove(PREFERENCES);
		};
		
		// load preferences
		GraXpert4PixParams._loadPreferences();
	},
	
	savePreferences: function() {
		// save preferences
		File.writeTextFile(PREFERENCES, JSON.stringify(GraXpert4PixParams));
	},
	
	_loadParameters: function() {
		// always check if a value with the given key exists since the parameters table
		// can be obsolete or can be modified by the user manually
		let errors = 0;

		// load and check AI model
		if (Parameters.has("ai_model")) {
			let ai_model = Parameters.getString("ai_model");
			let ai_models = GraXpert4PixParams.getAIModels();
			if ( ai_models.length == 0 ) {
				GraXpert4PixParams.ai_model = "";
			} else if ((ai_model != "") && (ai_models.indexOf(ai_model) == -1)) {
				errors++;
				Console.warningln("AI model \"" + ai_model + "\" no more stored locally.");
				GraXpert4PixParams.ai_model = ai_models[0];
				Console.warningln("Default model \"" + GraXpert4PixParams.ai_model + "\" will be used.");
			} else if (ai_model == "") {
				GraXpert4PixParams.ai_model = ai_models[0];
			} else {
				GraXpert4PixParams.ai_model = ai_model;
			};
		};

		// load and check smoothing
		if (Parameters.has("smoothing")) {
			try {
				let smoothing = Parameters.getReal("smoothing");
				if ((smoothing < 0) || (smoothing > 1)) {
					throw "Error value range";
				};
				GraXpert4PixParams.smoothing = smoothing;
			} catch (error) {
				Console.warningln("Invalid smoothing value \"" + Parameters.getString("smoothing") + "\". Select value in range [0, 1]");
				Console.warningln("Default smoothing will be used (" + GraXpert4PixParams.smoothing + ")");
				errors++;
			};
		};
		
		// load and check correction
		if (Parameters.has("correction")) {
			let correction = (Parameters.getString("correction") == "" ? "Subtraction" : Parameters.getString("correction"));
			const corrections = ["Subtraction", "Division"];
			if ((correction != "") && (corrections.indexOf(correction) == -1)) {
				Console.warningln("Invalid correction \"" + correction + "\". Select one of \"" + corrections.join("\", \"") + "\"");
				Console.warningln("Default correction will be used");
				GraXpert4PixParams.correction = "Subtraction";
				errors++;
			} else {
				GraXpert4PixParams.correction = Parameters.getString("correction");
			};
		};
		
		// load and check replace target flag
		try {
			if (Parameters.has("replace_target"))
				GraXpert4PixParams.replace_target = Parameters.getBoolean("replace_target");
		} catch (error) {
			Console.warningln("Invalid replace target \"" + Parameters.getString("replace_target") + "\". Select \"true\" or \"false\"");
			Console.warningln("Default replace target will be used (" + GraXpert4PixParams.replace_target + ")");
			errors++;
		};
		
		// load and check background flag
		try {
			if (Parameters.has("background"))
				GraXpert4PixParams.background = Parameters.getBoolean("background");
		} catch (error) {
			Console.warningln("Invalid background flag \"" + Parameters.getString("background") + "\". Select \"true\" or \"false\"");
			Console.warningln("Default background will be used (" + GraXpert4PixParams.background + ")");
			errors++;
		};
		
		// load and check debug flag
		try {
			if (Parameters.has("debug"))
				GraXpert4PixParams.debug = Parameters.getBoolean("debug");
		} catch (error) {
			Console.warningln("Invalid debug \"" + Parameters.getString("debug") + "\". Select \"true\" or \"false\"");
			Console.warningln("Default debug will be used (" + GraXpert4PixParams.debug + ")");
			errors++;
		};
		
		// return total number of errors
		return errors;
	},
	
	initPath: function() {
		// get and check existing path
		let path = GraXpert4PixParams.getPath();
		if (path != undefined) {
			return path;
		};
		
		// pop-up error and ask for new path
		let mb = new MessageBox(
				"<p><center>Select path to GraXpert first!<br>"+
				"(GraXpert " + GRAXPERT_MINIMAL_VERSION + " or higher required)</center></p>"+
				"<p><center><a href='" + GRAXPERT_RELEASES + "'>GraXpert available here</a></center></p>",
				TITLE,
				StdIcon_NoIcon,
				StdButton_Ok, StdButton_Cancel
		);
		if ( mb.execute() == StdButton_Ok ) {
			GraXpert4PixParams.setPath();
		};
		
		// get and check and return path
		return GraXpert4PixParams.getPath();
	},
	
	setPath: function() {
		// no configuration file or invalid path
		var fd = new OpenFileDialog();
#ifeq __PI_PLATFORM__ MACOSX
		fd.caption = "Select GraXpert from your applications folder...";
		fd.filters = [["Apps", ".app"]];
#endif
#ifeq __PI_PLATFORM__ MSWINDOWS
		fd.caption = "Select GraXpert from your programs folder...";
		fd.filters = [["Programs", ".exe", ".bat"]];
#endif
#ifeq __PI_PLATFORM__ LINUX
		fd.caption = "Select GraXpert from your applications folder...";
#endif
		if (fd.execute()) {
			let path = fd.fileName;
			Console.writeln("<br><b>Set GraXpert path:</b>");
			Console.writeln(path.replace("\\", "/"));
			File.writeTextFile(GRAXPERT_PATH_CFG, JSON.stringify({ 'path': path}));
		};
	},
	
	getPath: function() {
		// get existing path
		if ( File.exists(GRAXPERT_PATH_CFG) ) {
			let path = undefined;
			try {
				path = JSON.parse(File.readTextFile(GRAXPERT_PATH_CFG)).path;
			} catch (error) {
				Console.criticalln("Retrieve preferences failed");
				Console.criticalln(error);
			};
			if ( path != undefined ) {
#ifeq __PI_PLATFORM__ MACOSX
				if ( File.directoryExists(path) ) return path;
#endif
#ifeq __PI_PLATFORM__ MSWINDOWS
				if ( File.exists(path) ) return path;
#endif
#ifeq __PI_PLATFORM__ LINUX
				// FIXME: Not sure if I should consider file or directory
				// if ( File.directoryExists(path) ) return path;
				if ( File.exists(path) ) return path;
#endif
			};
		};
		return undefined;
	},
	
	getAIModels: function() {
		let ai_models = [];
		let f = new FileFind;
		if ( f.begin( GRAXPERT_AI_MODELS ) ) do {
			if ( f.isDirectory && f.name != "." && f.name != ".." ) {
			   ai_models.push(f.name);
			};
		} while ( f.next() );
		return ai_models.sort().reverse();
	}
};


/*
 * GraXpert engine
 */
function GraXpert4PixEngine() {
	this.process = new ExternalProcess();
	this.logs = [];
	this.dialog = false;
	this.extensions = ["xisf", "fits", "tiff"];

	this.run = function(command, detach_after=0) {
		// start time measure
		let execTime = Date.now();
		
		// launch command
		this.process.start(command);
		
		// enable console abort after any new start process
		Console.abortEnabled = true;
		
		// wait exit
		this.progress();
		if ( this.process.waitForStarted() )
		{
			let time_counter = 0;
			this.progress();
			while ( (detach_after == 0 || (detach_after/250) > time_counter) && !this.process.waitForFinished( 250 ) && this.process.isRunning ) {
				// check timeout
				if ( ++time_counter >= (4*300) ) {
					this.progress("Execute timout (" + (time_counter/4) + ")");
					throw "Process timeout";
				};
				this.progress();
			};
			this.progress();
		};
		
		// process canot be aborted
		Console.abortEnabled = false;
			
		// check errors
		if (this.process.error == ProcessError_FailedToStart) {
			this.progress("Process failed to start");
			throw "Command line: " + command;
		};
		if (this.process.error == ProcessError_Crashed) {
			this.progress("Aborted");
			throw false;
		};
		if (this.process.error == ProcessError_ReadError) {
			this.progress("Process read error");
			throw "Command line: " + command;
		};
		if (this.process.error == ProcessError_UnknownError) {
			this.progress("Process unknown error");
			throw "Command line: " + command;
		};
		
		// retrieve logs (this will flush stdout)
		if ( detach_after > 0 ) this.progress("Started")
		else this.progress("Completed");
		this.logs = String(this.process.stdout).split("\r\n");
		
		// measure time
		execTime = Math.floor( (Date.now() - execTime) / 1000 );
		
		// return execution time
		return execTime;
	};
	
	this.progress = function (status=undefined)
	{
		processEvents();
		if ((Console.abortRequested) && (this.process.isRunning)) {
			this.process.kill();
			return;
		};
		if( typeof this.progress.counter == 'undefined' ) {
			this.progress.counter = 0;
		};
		if ( status === undefined ) {
			Console.write( "<end>\b" + "-\\|/".charAt( this.progress.counter%4 ) );
			this.progress.counter++
		} else if ( status == "Completed" || status == "Started" ) {
			Console.writeln( "<end>\b \b" + status );
			this.progress.counter = 0
		} else {
			Console.write( "<end>\b \b" );
			Console.criticalln( status );
			this.progress.counter = 0;
		};
		Console.flush();
	};
	
	this.filterErrors = function (line) {
		let filter = ["floating-point round-off errors"];
		for (var msg of filter) {
			if ( line.toLowerCase().contains(msg.toLowerCase()) ) return true;
		};
		return false;
	};
	
	this.getVersion = function() {
		for (var line of this.logs) {
			if (line.toLowerCase().contains("Starting GraXpert".toLowerCase())) {
				let match = line.match(/version: (\S+)/);
				if (match) {
					return match[1];
				};
			};
		};
		return false;
	};

	this.report = function (silent=false) {
		let errors = 0;
		let counter = 0;
		let s3_errors = 0;
		let error_args = false;
		
		for (var line of this.logs) {
			if (line.length > 0) {
				counter ++;
			};
			if (line.toLowerCase().contains("error")) {
				// report warning but do not trigger display of GraXpert logs
				if (line.toLowerCase().contains("s3_secrets")) {
					if (s3_errors == 0) Console.warningln("s3_secrets missing (download AI model won't be possible if needed)")
					s3_errors++;
					continue;
				};
				// ignore some error tags
				if (this.filterErrors(line)) {
					continue;
				};
				// error confirmed
				errors++;
			};
			if (line.toLowerCase().contains("unrecognized arguments")) {
				error_args = true;
			};
		};
		
		// dump logs
		if (counter > 0 && (!silent || errors > 0 || GraXpert4PixParams.debug )) {
			Console.writeln("<br><b>GraXpert logs:</b> ");
			for (var line of this.logs) {
				if (line.length == 0) {
					continue;
				};
				if (line.toLowerCase().contains("error")) {
					Console.criticalln(line);
				} else if (line.toLowerCase().contains("warning")) {
					Console.warningln(line);
				} else {
					Console.writeln(line);
				};
			};
			if ( error_args ) {
				Console.criticalln("<br>Please ensure you have GraXpert " + GRAXPERT_MINIMAL_VERSION + " or higher");
			};
			Console.write("<reset-font>");
		};
	};
	
	// load library inside engine
	#include "WCSmetadata.jsh"
	this.copyCoordinates = function (reference, processed) {
		Console.writeln("<br><b>Copy coordinates:</b>");
		// Extract metadata
		var metadata0 = new ImageMetadata("GraXpertSuite");
		metadata0.ExtractMetadata(reference);
		if (!metadata0.projection || !metadata0.ref_I_G) {
			Console.writeln("The reference image has no astrometric solution");
		} else {
			// Set keywords and properties
			metadata0.SaveKeywords( processed, false/*beginProcess*/ );
			metadata0.SaveProperties( processed, TITLE + " " + VERSION);
		};
	};
	
	function cloneView(targetView, Id, forceClose=true) {
		var img = targetView.mainView.image;
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
		
		if (forceClose) {
			targetView.forceClose();
		};
		
		return cloneImageWindow;
	};
	
	function isAutoStretched(view) {
		let noSTF = [
		   [0.50000, 0.00000, 1.00000, 0.00000, 1.00000],
		   [0.50000, 0.00000, 1.00000, 0.00000, 1.00000],
		   [0.50000, 0.00000, 1.00000, 0.00000, 1.00000],
		   [0.50000, 0.00000, 1.00000, 0.00000, 1.00000]
		];
		return (view.stf.toString() !== noSTF.toString());
	};
	
	function STFAutoStretch(view) {
		let shadowsClipping = DEFAULT_AUTOSTRETCH_SCLIP;
		let targetBackground = DEFAULT_AUTOSTRETCH_TBGND;

		var stf = new ScreenTransferFunction;
		var n = view.image.isColor ? 3 : 1;
		var median = view.computeOrFetchProperty( "Median" );

		var mad = view.computeOrFetchProperty( "MAD" );
		mad.mul( 1.4826 ); // coherent with a normal distribution

		/*
		* Unlinked RGB channnels: Compute automatic stretch functions for
		* individual RGB channels separately.
		*/
		var A = [ // c0, c1, m, r0, r1
			   [0, 1, 0.5, 0, 1],
			   [0, 1, 0.5, 0, 1],
			   [0, 1, 0.5, 0, 1],
			   [0, 1, 0.5, 0, 1] ];

		for ( var c = 0; c < n; ++c )
		{
		 if ( median.at( c ) < 0.5 )
		 {
			/*
			 * Noninverted channel
			 */
			var c0 = (1 + mad.at( c ) != 1) ? Math.range( median.at( c ) + shadowsClipping * mad.at( c ), 0.0, 1.0 ) : 0.0;
			var m  = Math.mtf( targetBackground, median.at( c ) - c0 );
			A[c] = [c0, 1, m, 0, 1];
		 }
		 else
		 {
			/*
			 * Inverted channel
			 */
			var c1 = (1 + mad.at( c ) != 1) ? Math.range( median.at( c ) - shadowsClipping * mad.at( c ), 0.0, 1.0 ) : 1.0;
			var m  = Math.mtf( c1 - median.at( c ), targetBackground );
			A[c] = [0, c1, m, 0, 1];
		 }
		};

		stf.STF = A;

	   stf.executeOn( view );
	};

	
	this.execute = function(targetView, ui_mode=false) {
		// return if GraXpert path not yet defined
		let graxpertPath = GraXpert4PixParams.initPath();
		if (this.dialog) {
			this.dialog.updatePathIcon();
		};
		if (graxpertPath == undefined) {
			return;
		};
		
		// set files and command line
		var clonedView = false;
		var tmpFile = File.systemTempDirectory+"/Pix.xisf";
		var outFile = File.systemTempDirectory+"/Pix_GraXpert.xisf";
		var bkgFile = File.systemTempDirectory+"/Pix_GraXpert_background.xisf";
		var command = "\"" + graxpertPath + "\" \"" + tmpFile + "\" -cli";
		
		// add parameters to command line
		if ( GraXpert4PixParams.background ) {
			command += " -bg";
		};
		if ( GraXpert4PixParams.smoothing !== "" ) {
			command += " -smoothing " + GraXpert4PixParams.smoothing;
		};
		if ( !ui_mode && GraXpert4PixParams.ai_model !== "" ) {
			command += " -ai_version " + GraXpert4PixParams.ai_model;
		};
		if ( GraXpert4PixParams.correction !== "" ) {
			command += " -correction " + GraXpert4PixParams.correction;
		};
		if ( ui_mode ) {
			command += " --preferences_file \"" + GRAXPERT_PREFERENCES + "\"";
		};
		
		// clean-up files
		if (File.exists(tmpFile)) File.remove(tmpFile);
		if (File.exists(outFile)) File.remove(outFile);
		if (File.exists(bkgFile)) File.remove(bkgFile);
		
		try {
			Console.show();
			
			// save image into temporary folder without changing target view
			clonedView = cloneView(targetView.window, "Pix", false);
			if ( !clonedView.saveAs(tmpFile, false, false, true, false) ) {
				throw "Save error";
			};
			clonedView.forceClose();
			clonedView = false;
		
			// execute GraXpert
			Console.writeln("<br><b>Run GraXpert:</b>");
			Console.writeln("Exec: " + graxpertPath);
			Console.writeln("Input:  " + tmpFile);
			Console.writeln("Output: " + outFile);
			if ( GraXpert4PixParams.background ) Console.writeln("Background: " + bkgFile);
			Console.writeln("Debug: " + (GraXpert4PixParams.debug ? "On" : "Off"));
			if ( ui_mode ) {
				Console.writeln("Interpolation: Refer GraXpert UI Preferences");
			} else {
				if (GraXpert4PixParams.ai_model == "") {
					let mb = new MessageBox(
						"<p><center>GraXpert AI model(s) not yet installed !</center></p>"+
						"<p><center>The first execution will installe the default model.<br>"+
						"This may delay processing of first image by several minutes.</center></p>",
						TITLE,
						StdIcon_NoIcon,
						StdButton_Ok
					);
					mb.execute();
				};
				Console.writeln("Interpolation: AI");
				Console.writeln("AI model: " + (GraXpert4PixParams.ai_model == "" ? "Default" : GraXpert4PixParams.ai_model));
			};
			Console.writeln("Smoothing: " + GraXpert4PixParams.smoothing);
			Console.writeln("Correction: " + (GraXpert4PixParams.correction == "" ? "Default" : GraXpert4PixParams.correction));
			if ( GraXpert4PixParams.debug ) {
				Console.writeln("Command line: "+command);
			};
			if ( GraXpert4PixParams.getAIModels().length == 0 ) {
				Console.warningln("GraXpert will download default AI model, this may take several minutes.");
			};
			
			// run command line
			Console.write("Status:  ");
			let execTime = this.run(command);
			
			// check File
			if (!File.exists( outFile )) {
				this.progress("File not found");
				throw "File " + outFile + " not found";
			};
			
			// dump infos
			Console.writeln("<br><b>Execution details:</b>");
			let version = this.getVersion();
			if (version.toLowerCase() == "snapshot") {
				Console.warningln("GraXpert version: " + version);
			} else if (!version) {
				Console.warningln("GraXpert version: " + (GraXpert4PixParams.debug ? "Undefined (check GraXpert logs)" : "Undefined (activate debug for more details)"));
			} else {
				Console.writeln("GraXpert version: " + version);
			};
			Console.writeln("Running time: " + execTime + " seconds");
			
			// check and report logs
			this.report(true);
			
			// open background
			if ( GraXpert4PixParams.background ) {
				if (!File.exists( bkgFile )) {
					Console.warningln("Background file not found");
					Console.warningln("Please ensure you have last version of GraXpert");
				} else {
					var background = ImageWindow.open(bkgFile)[0];
					if (Console.abortRequested) {
						background.forceClose();
						throw "Process aborted";
					};
				};
			};
			
			// open processed
			let processed = ImageWindow.open(outFile, '', '', true)[0];
			if (Console.abortRequested) {
				processed.forceClose();
				if (background) background.forceClose();
				throw "Process aborted";
			};
			
			if (GraXpert4PixParams.replace_target) {
				// replace existing view instead of creating a new view
				targetView.beginProcess();
				targetView.image.assign( processed.mainView.image );
				targetView.endProcess();
				processed.forceClose();
				if ( isAutoStretched(targetView) ) {
					STFAutoStretch(targetView);
				};
			} else {
				// clone processed into new ImageWindow
				processed = cloneView(processed, "GraXpert");
				
				// restore original fit header
				// refer https://github.com/Steffenhir/GraXpert/issues/70
				processed.keywords = targetView.window.keywords;
				
				// restore original metadata
				// refer https://github.com/Steffenhir/GraXpert/issues/85
				this.copyCoordinates(targetView.window, processed);
			
				// show new image
				if ( isAutoStretched(targetView) ) {
					STFAutoStretch(processed.mainView);
				};
				processed.show();
			};
			
			// show Background
			if (background) {
				background = cloneView(background, "GraXpert_background");
				STFAutoStretch(background.mainView);
				background.show();
			};
			
			// end message
			Console.noteln("\n<b>GraXpert successfully completed<\b>");
			
		} catch (error) {
			if (clonedView) {
				clonedView.forceClose();
			};
			if (error) {
				Console.criticalln(error);
				this.report();
			};
		};
		
		// clean-up files
		if (File.exists(tmpFile)) File.remove(tmpFile);
		if (File.exists(outFile)) File.remove(outFile);
		if (File.exists(bkgFile)) File.remove(bkgFile);
		
		// flush console
		Console.flush();
		Console.hide();
	};
	
	this.export = function(targetView = false) {
		// return if GraXpert path not yet defined
		let graxpertPath = GraXpert4PixParams.initPath();
		if (this.dialog) {
			this.dialog.updatePathIcon();
		};
		if (graxpertPath == undefined) {
			return;
		};
		
		// set paths to temporary files
		var tmpFile = File.systemTempDirectory+"/PixInsight.xisf";
		var outFile = File.systemTempDirectory+"/PixInsight_GraXpert.";
		var bkgFile = File.systemTempDirectory+"/PixInsight_background.";
		
		// clean-up files
		if (File.exists(tmpFile)) File.remove(tmpFile);
		for (var ext of this.extensions) {
			if (File.exists(outFile+ext)) File.remove(outFile+ext);
			if (File.exists(bkgFile+ext)) File.remove(bkgFile+ext);
		};
		
		try {
			if (!targetView || targetView.window.isNull) {
				// log launching
				Console.show();
				Console.writeln("<br><b>Launch GraXpert UI:</b>");
				Console.writeln("Exec: " + graxpertPath);
				Console.writeln("GraXpert may take few seconds to start... ");
				// just launch GraXpert UI if no valid target view and close dialog
				this.run("\"" + graxpertPath + "\"", 8000);
				if (this.dialog) {
					this.dialog.ok();
				};
			} else {
				// save image into temporary folder without changing target view
				var clonedView = cloneView(targetView.window, "Pix", false);
				if ( clonedView.saveAs(tmpFile, false, false, true, false) ) {
					// launch GraXpert UI with automatic target view loading
					clonedView.forceClose();
					// log launching
					Console.show();
					Console.writeln("<br><b>Launch GraXpert UI:</b>");
					Console.writeln("Exec: " + graxpertPath);
					Console.writeln("File: " + tmpFile);
					Console.writeln("GraXpert may take few seconds to start... ");
					this.run("\"" + graxpertPath + "\" \"" + tmpFile + "\"", 8000);
				} else {
					clonedView.forceClose();
					// log launching
					Console.show();
					Console.writeln("<br><b>Launch GraXpert UI:</b>");
					Console.criticalln("Save error");
				};
			};
		} catch (error) {
			if (error) {
				Console.criticalln(error);
				this.report();
			};
		};
		
		// please wait
		Console.flush();
	};
	
	this.import = function(targetView) {
		// set paths to temporary files
		var tmpFile = File.systemTempDirectory+"/PixInsight.xisf";
		var outFile = File.systemTempDirectory+"/PixInsight_GraXpert.";
		var bkgFile = File.systemTempDirectory+"/PixInsight_background.";
		
		try {
			// search processed file
			Console.writeln("<br><b>Search processed file(s):</b>");
			Console.writeln("Path: " + File.systemTempDirectory);
			var processed = false;
			for (var ext of this.extensions) {
				if (File.exists( outFile+ext )) {
					processed = outFile+ext;
					Console.writeln("processed: " + processed);
					break;
				};
			};
			
			// search background file
			var background = false;
			for (var ext of this.extensions) {
				if (File.exists( bkgFile+ext )) {
					background = bkgFile+ext;
					Console.writeln("Background: " + background);
					break;
				};
			};
			
			// read files
			if (processed) {
				// open processed file
				processed = ImageWindow.open(processed, '', '', true)[0];
				
				// clone processed into new ImageWindow
				processed = cloneView(processed, "GraXpert");
				
				// check geometrie
				if (targetView.image.width !=processed.mainView.image.width || targetView.image.height != processed.mainView.image.height) {
					// pop-up error and ask for new path
					let mb = new MessageBox(
							"<p><center>Astrometric solution deleted as a result <br>of the geometric transformation.</center></p>",
							TITLE,
							StdIcon_NoIcon,
							StdButton_Ok
					);
					mb.execute();
					Console.warningln("Astrometric solution deleted as a result of the geometric transformation.")
				} else {
					// restore original fit header
					// refer https://github.com/Steffenhir/GraXpert/issues/70
					processed.keywords = targetView.window.keywords;
					
					// restore original metadata
					// refer https://github.com/Steffenhir/GraXpert/issues/85
					this.copyCoordinates(targetView.window, processed);
				}
			
				// show new image
				if ( isAutoStretched(targetView) ) {
					STFAutoStretch(processed.mainView);
				};
				processed.show();
			};
			
			if (background) {
				// open background
				background = ImageWindow.open(background)[0];
				
				// clone and show background
				background = cloneView(background, "GraXpert_background")
				STFAutoStretch(background.mainView);
				background.show();
			};
			
			if (processed || background) {
				// end message
				Console.noteln("\n<b>GraXpert file(s) successfully imported<\b>");
				
				// close dialog
				if (this.dialog) {
					this.dialog.ok();
				};
				
				// flush and close console
				Console.flush();
				Console.hide();
			} else {
				// pop-up message
				let mb = new MessageBox(
					"<p><center>GraXpert file(s) not found</center></p>",
					TITLE,
					StdIcon_NoIcon,
					StdButton_Ok
				);
				mb.execute();
				// end message
				Console.warningln("GraXpert file(s) not found");
				Console.show();
			};
		} catch (error) {
			if (error) {
				Console.show();
				Console.criticalln(error);
				return;
			};
		} finally {
			// clean-up files
			if (File.exists(tmpFile)) File.remove(tmpFile);
			for (var ext of this.extensions) {
				if (File.exists(outFile+ext)) File.remove(outFile+ext);
				if (File.exists(bkgFile+ext)) File.remove(bkgFile+ext);
			};
		};
	};
	
	this.getGraXpertPreferences = function() {
		let preferences = undefined;
		if ( File.exists(GRAXPERT_PREFERENCES) ) {
			try {
				// get preferences from file
				preferences = JSON.parse(File.readTextFile(GRAXPERT_PREFERENCES));
			} catch (error) {
				Console.criticalln("Retrieve GraXpert preferences failed");
				Console.criticalln(error);
			};
		};
		return preferences;
	};
	
	this.preferences = function(targetView, silent=false) {
		let labels = {
			// stretch option
			"stretch_option": "[ ] Stretch Options",
			"saturation": "[ ] Saturation",
			// sample selection[ ] 
			"display_pts": "[ ] Display points",
			"bg_flood_selection_option": "[ ] Flooded generation",
			"bg_pts_option": "[ ] Points per row",
			"bg_tol_option": "[ ] Grid Tolerance",
			"background_points": "[x] Grid",
			// calculatiion
			"interpol_type_option": "[x] Interpolation method",
			"smoothing_option": "[x] Smooting",
			// saving
			"saveas_option": "[ ] Saving",
			// advanced
			"sample_size": "[ ] Sample size",
			"sample_color": "[ ] Sample color",
			// interpolation
			"RBF_kernel": "[x] RBF Kernel",
			"spline_order": "[x] Spline order",
			"corr_type": "[x] Correction",
			// interface
			"lang": "[ ] Language",
			"scaling": "[ ] Scaling",
			// ai-model
			"ai_version": "[x] AI version",
			// misc.
			// "graxpert_version": "[x] GraXpert version", // version not properly updated / problem to be reported to GraXpert team / Information hidden for the moment
			"working_dir": "[ ] Working directory",
			"width": "[x] Width",
			"height": "[x] Height",
		};
		let gridRequirements = {
			"RBF": 1,
			"Splines": 16,
			"Kriging": 2,
			"AI": 0,
		};
		let errors = 0;
		
		if (!silent) {
			Console.writeln("<br><b>GraXpert UI Preferences and PixInsight Parameters:</b>");
			Console.writeln("Path: " + GRAXPERT_PREFERENCES);
		}
			
		// get and display preferences
		let preferences = this.getGraXpertPreferences();
		if ( preferences == undefined ) {
			if (!silent) Console.warningln("GraXpert preferences file not found (default values will be used)");
		} else {
			for (var param in labels) {
				if (preferences.hasOwnProperty(param)) {
					if (labels[param].contains("[ ]") && !GraXpert4PixParams.debug) {
						continue;
					};
					// check errors
					if (param == "width" && targetView.image.width > 0 && preferences["interpol_type_option"] != "AI" && preferences["width"] != targetView.image.width) {
						if (!silent) Console.criticalln(labels[param] + ": " + preferences[param] + " ("+
							targetView.image.width +" from PixInsight)");
						errors++;
					} else if (param == "height" && targetView.image.height > 0 && preferences["interpol_type_option"] != "AI" && preferences["height"] != targetView.image.height) {
						if (!silent) Console.criticalln(labels[param] + ": " + preferences[param] + " ("+
							targetView.image.height +" from PixInsight)");
						errors++;
					} else if (param == "background_points" && 
						gridRequirements.hasOwnProperty(preferences["interpol_type_option"]) && 
						preferences[param].length < gridRequirements[preferences["interpol_type_option"]]) {
						if (!silent) Console.criticalln(labels[param] + ": " + preferences[param].length + " points ("+
							gridRequirements[preferences["interpol_type_option"]]+" points required for "+preferences["interpol_type_option"]+" interpolation)");
						errors++;
					// continue in silent mode
					} else if (silent) {
						continue;
					// display preferences
					} else if (param == "interpol_type_option" && !gridRequirements.hasOwnProperty(preferences["interpol_type_option"])) {
						Console.warningln(labels[param] + ": " + preferences[param]+" (no grid requirement defined)");
					} else if (preferences[param] instanceof Array) {
						Console.writeln(labels[param] + ": " + preferences[param].length + " points");
					} else if (param == "smoothing_option" && preferences[param] != GraXpert4PixParams.smoothing) {
						Console.warningln(labels[param] + ": " + preferences[param] + " (" + GraXpert4PixParams.smoothing + " from PixInsight)");
					} else if (param == "corr_type" && preferences[param] != GraXpert4PixParams.correction) {
						Console.warningln(labels[param] + ": " + preferences[param] + " (" + GraXpert4PixParams.correction + " from PixInsight)");
					} else if (param == "width" && targetView.image.width > 0 && preferences[param] != targetView.image.width) {
						Console.warningln(labels[param] + ": " + preferences[param] + " (" + targetView.image.width + " from PixInsight)");
					} else if (param == "height" && targetView.image.height > 0 && preferences[param] != targetView.image.height) {
						Console.warningln(labels[param] + ": " + preferences[param] + " (" + targetView.image.height + " from PixInsight)");
					} else {
						Console.writeln(labels[param] + ": " + preferences[param]);
					};
				} else {
					if (!silent) Console.criticalln(param + ": " + preferences[param] + " (new setting)");
				};
			};
		};
		if (!silent) {
			if (errors > 0) Console.warningln("Process a photo in GraXpert UI to set compatibe preferences.")
			Console.show();
			Console.flush();
		}
		return errors;
	};
};

#endif	// __GRAXPERT_HELPER_jsh

#ifdef __GRAXPERT_ALL_IN_ONE_DIALOG__
/*
 * GraXpert dialog interface
 */
function GraXpert4PixDialog(targetView, engine) {
	this.__base__ = Dialog;
	this.__base__();
	
	this.updateButtons = function() {
		// update dialog controls
		if ( this.selectAI_Sizer ) {
			this.selectAI_ComboBox.currentItem = this.AIModels.indexOf(GraXpert4PixParams.ai_model);
		};
		if ( GraXpert4PixParams.correction == "" ) {
			this.selectCorrection_ComboBox.currentItem = 0;
		} else {
			this.selectCorrection_ComboBox.currentItem = this.corrections.indexOf(GraXpert4PixParams.correction);
		};
		this.smoothControl.setValue(GraXpert4PixParams.smoothing);
		this.createImageCheckBox.checked = !GraXpert4PixParams.replace_target;
		this.debugCheckBox.checked = GraXpert4PixParams.debug;
		this.backgroundCheckBox.checked = GraXpert4PixParams.background;
		
		// update buttons
		if ( targetView && targetView.id ) {
		  this.execButton.enabled = true;
		  this.exportButton.enabled = true;
		  this.importButton.enabled = true;
		  this.reprocessButton.enabled = true;
		} else {
		  this.execButton.enabled = false;
		  this.exportButton.enabled = false;
		  this.importButton.enabled = false;
		  this.reprocessButton.enabled = false;
		};
		
		// update GraXpert preference button
		if (engine.getGraXpertPreferences() == undefined) {
			this.preferencesButton.icon = this.scaledResource( ":/icons/list-warn.png" );
		} else if (engine.preferences(targetView, true) > 0) {
			this.preferencesButton.icon = this.scaledResource( ":/icons/list-error.png" );
		} else {
			this.preferencesButton.icon = this.scaledResource( ":/icons/list.png" );
		};
	};
	
	this.updatePathIcon = function() {
		if ( GraXpert4PixParams.getPath() == undefined ) {
			this.pathButton.icon = this.scaledResource( ":/icons/process-error.png" );
		} else {
			this.pathButton.icon = this.scaledResource( ":/icons/process-ok.png" );
		};
	};
	
	// set dialog in engine
	engine.dialog = this;
	
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
	this.title.text = "<b>" + TITLE + " version " + VERSION + "</b><br>GraXpert is an astronomical image processing program for extracting and removing gradients from the background of your astrophotos.<br><a href='" + DEEPSKYFORGE + "'>Visit DeepSkyForge website</a>";

	// create a view picker
	this.viewList = new ViewList(this);
	this.viewList.getAll();
	this.viewList.currentView = targetView;
	this.viewList.onViewSelected = ( view ) => {
	  targetView = view;
	  this.updateButtons();
	};;

	// create smoothing control
	this.smoothControl = new NumericControl(this);
	this.smoothControl.label.text = "Smoothing:";
	this.smoothControl.label.width = 60;
	this.smoothControl.setRange(0, 1);
	this.smoothControl.slider.setRange( 0, 100 );
	this.smoothControl.setPrecision( 3 );
	this.smoothControl.toolTip = "<p>Adjust the strength of smoothing, ranging from 0.0 (no smoothing) to 1 (maximum smoothing).</p>";
	this.smoothControl.onValueUpdated = function( value ) {
		GraXpert4PixParams.smoothing = value;
	};
	
	// reset smooth control
	this.resetSmooth = new ToolButton( this );
	this.resetSmooth.icon = this.scaledResource( ":/icons/clear-inverted.png" );
	this.resetSmooth.setScaledFixedSize( 24, 24 );
	this.resetSmooth.toolTip = "<p>Reset smoothing to its default.</p>";
	this.resetSmooth.onClick = () => {
		GraXpert4PixParams.smoothing = defaults().smoothing;
		this.smoothControl.setValue( GraXpert4PixParams.smoothing );
	};
	
	// create a horizontal slider to layout the smooth control
	this.smoothing_Sizer = new HorizontalSizer();
	this.smoothing_Sizer.add(this.smoothControl);
	this.smoothing_Sizer.addSpacing(8);
	this.smoothing_Sizer.add(this.resetSmooth);

	// create correction combobox
	this.corrections = ["Subtraction", "Division"];
	this.selectCorrection_Label = new Label( this );
	this.selectCorrection_Label.text = "Correction:";
	this.selectCorrection_Label.useRichText = true;
	this.selectCorrection_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
	this.selectCorrection_Label.setMaxWidth( this.font.width( this.selectCorrection_Label.text ) );
	this.selectCorrection_Label.setFixedWidth( this.font.width( this.selectCorrection_Label.text ) );
	this.selectCorrection_ComboBox = new ComboBox( this );
	this.selectCorrection_ComboBox.editEnabled = false;
	this.selectCorrection_ComboBox.toolTip = "<p>Select the background correction method. Options are \"Subtraction\" (default) or \"Division\".</p>";
	this.corrections.forEach((element) => this.selectCorrection_ComboBox.addItem(element));
	this.selectCorrection_ComboBox.onItemSelected = ( index ) => {
		GraXpert4PixParams.correction = this.corrections[index];
	};
	this.selectCorrection_Sizer = new HorizontalSizer;
	this.selectCorrection_Sizer.spacing = 4;
	this.selectCorrection_Sizer.add( this.selectCorrection_Label );
	this.selectCorrection_Sizer.add( this.selectCorrection_ComboBox );
	this.selectCorrection_Sizer.addStretch();
	
	// create replace target image
	this.createImageCheckBox = new CheckBox( this );
	this.createImageCheckBox.text = "Create new image";
	this.createImageCheckBox.toolTip = "<p>Create new image or replace target image. When image is processed in GraXpert UI (see advanced features), import or reprocessing will always create a new image.</p>";
	this.createImageCheckBox.onClick = function( checked ) {
		GraXpert4PixParams.replace_target = !checked;
	};
	
	// create background checkbox
	this.backgroundCheckBox = new CheckBox( this );
	this.backgroundCheckBox.text = "Create background model";
	this.backgroundCheckBox.toolTip = "<p>Create background model.</p>";
	this.backgroundCheckBox.onClick = function( checked ) {
		GraXpert4PixParams.background = checked;
	};
	
	// create sizer
	this.selectCreate_Sizer = new HorizontalSizer;
	this.selectCreate_Sizer.spacing = 4;
	this.selectCreate_Sizer.add( this.createImageCheckBox );
	this.selectCreate_Sizer.addStretch();
	this.selectCreate_Sizer.add( this.backgroundCheckBox );
	
	// create select AI combobox when several models locally installed
	this.selectAI_Sizer = false;
	this.AIModels = GraXpert4PixParams.getAIModels();
	if ( this.AIModels.length > 0 ) {
		this.selectAI_Label = new Label( this );
		this.selectAI_Label.text = "AI version:";
		this.selectAI_Label.useRichText = true;
		this.selectAI_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
		this.selectAI_Label.setMaxWidth( this.font.width( this.selectAI_Label.text ) );
		this.selectAI_Label.setFixedWidth( this.font.width( this.selectAI_Label.text ) );
		this.selectAI_ComboBox = new ComboBox( this );
		this.selectAI_ComboBox.editEnabled = false;
		this.selectAI_ComboBox.toolTip = "<p>Specify the version of the AI model to use. "+
										 "If not provided, it defaults to the latest available version. "+
										 "You can choose only locally available AI models. "+
										 "Run GraXpert UI to download additional AI models.</p>";
		this.AIModels.forEach((element) => this.selectAI_ComboBox.addItem(element));
		this.selectAI_ComboBox.onItemSelected = ( index ) => {
			GraXpert4PixParams.ai_model = this.AIModels[index];
		};
		this.selectAI_Sizer = new HorizontalSizer;
		this.selectAI_Sizer.spacing = 4;
		this.selectAI_Sizer.add( this.selectAI_Label );
		this.selectAI_Sizer.add( this.selectAI_ComboBox );
		this.selectAI_Sizer.addStretch();
	};
	
	// create debug checkbox
	this.debugCheckBox = new CheckBox( this );
	this.debugCheckBox.text = "Debug GraXpert";
	this.debugCheckBox.toolTip = "<p>Activate GraXpert debug</p>";
	this.debugCheckBox.onClick = function( checked ) {
		GraXpert4PixParams.debug = checked;
	};
	
	// Export / Import label
	this.launch_Label = new Label( this );
	this.launch_Label.text = "Export / Import";
	this.launch_Label.useRichText = true;
	this.launch_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
	this.launch_Label.setMaxWidth( this.font.width( this.launch_Label.text ) );
	this.launch_Label.setFixedWidth( this.font.width( this.launch_Label.text ) );
	
	// export file
	this.exportButton = new ToolButton( this );
	this.exportButton.setScaledFixedSize( 16, 16 );
	this.exportButton.icon = this.scaledResource( ":/icons/document-export.png" );
	this.exportButton.toolTip = "<p>Open target view in GraXpert UI. If you want to import GraXpert's result files (Gradient removal and background) and restore astrometric data, ensure initial image used for the export is open and selected in PixInsight, result files from GraXpet are saved with their defaut names PixInsight_GraXpert.tiff and PixInsight_background.tiff (xisf and fits files accepted as well).</p>";
	this.exportButton.onClick = () => {
		// import GraXpert result
		engine.export(targetView);
	};
	
	// launch UI button
	this.launchButton = new ToolButton( this );
	this.launchButton.setScaledFixedSize( 16, 16 );
	this.launchButton.icon = this.scaledResource( ":/icons/screen.png" );
	this.launchButton.toolTip = "<p>Launch GraXpert UI without export of target view. Click on Export button if you want to open target view in GraXpert.</p>";
	this.launchButton.onClick = () => {
		engine.export();
	};
	
	// import file(s)
	this.importButton = new ToolButton( this );
	this.importButton.setScaledFixedSize( 16, 16 );
	this.importButton.icon = this.scaledResource( ":/icons/document-import.png" );
	this.importButton.toolTip = "<p>Import files from GraXpert UI. Script will search files PixInsight_GraXpert.tiff and PixInsight_background.tiff (xisf and fits files accepted as well). Astrometric data will be restored using selected image in PixInsight.</p>";
	this.importButton.onClick = () => {
		// import GraXpert result
		engine.import(targetView);
	};
	
	// list GraXpert preferences
	this.preferencesButton_Label = new Label( this );
	this.preferencesButton_Label.text = "Preferences";
	this.preferencesButton_Label.useRichText = true;
	this.preferencesButton_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
	this.preferencesButton_Label.setMaxWidth( this.font.width( this.preferencesButton_Label.text ) );
	this.preferencesButton_Label.setFixedWidth( this.font.width( this.preferencesButton_Label.text ) );
	this.preferencesButton = new ToolButton( this );
	this.preferencesButton.setScaledFixedSize( 16, 16 );
	this.preferencesButton.icon = this.scaledResource( ":/icons/list-warn.png" );
	this.preferencesButton.toolTip = "<p>Display in console window GraXpert UI preferences applied or that will be applied on reprocessing. PixInsight smoothing and correction will overwrite GraXpert UI preferences.</p>";
	this.preferencesButton.onClick = () => {
		// update button just in case preference status changes
		this.updateButtons();
		// log preferences
		engine.preferences(targetView);
	};
	
	// reprocess image with last Preferences
	this.reprocessButton_Label = new Label( this );
	this.reprocessButton_Label.text = "Reprocess";
	this.reprocessButton_Label.useRichText = true;
	this.reprocessButton_Label.textAlignment = TextAlign_Right | TextAlign_VertCenter;
	this.reprocessButton_Label.setMaxWidth( this.font.width( this.reprocessButton_Label.text ) );
	this.reprocessButton_Label.setFixedWidth( this.font.width( this.reprocessButton_Label.text ) );
	this.reprocessButton = new ToolButton( this );
	this.reprocessButton.setScaledFixedSize( 16, 16 );
	this.reprocessButton.icon = this.scaledResource( ":/icons/repeat.png" );
	this.reprocessButton.toolTip = "<p>Reprocess target view using last GraXpert UI interpolation method, grid and other parameters. Take only smoothing and correction from PixInsight settings.</p>";
	this.reprocessButton.onClick = () => {
		// display preferences
		if (engine.preferences(targetView) > 0) {
			// pop-up alert
			let mb = new MessageBox(
				"<p><center>Current UI preferences does not allow image processing.<br>(Check console for details)</center></p>",
				TITLE,
				StdIcon_NoIcon,
				StdButton_Ok
			);
			mb.execute();
			return;
		};
		
		// save preferences
		GraXpert4PixParams.savePreferences();
		
		// close dialog
		this.ok();
		
		// reprocess target view
		engine.execute(targetView, true);
	};
	
	// select GraXpert path
	this.pathButton = new ToolButton( this );
	this.updatePathIcon();
	this.pathButton.setScaledFixedSize( 16, 16 );
	this.pathButton.toolTip = "<p>Setup the path to GraXpert.</p>";
	this.pathButton.onClick = () => {
		GraXpert4PixParams.setPath();
		this.updatePathIcon();
	};
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
	
	// advanced features
	this.tabUI_Section = new SectionBar( this, "GraXpert UI" );
	this.tabUI_Control = new Control( this );
	this.tabUI_Section.setSection( this.tabUI_Control );
	this.tabUI_Control.sizer = new VerticalSizer;
	this.tabUI_Sizer = new HorizontalSizer;
	this.tabUI_Sizer.spacing = 3;
	this.tabUI_Sizer.add( this.launch_Label );
	this.tabUI_Sizer.add( this.exportButton );
	this.tabUI_Sizer.add( this.launchButton );
	this.tabUI_Sizer.add( this.importButton );
	this.tabUI_Sizer.addStretch();
	this.tabUI_Sizer.add( this.preferencesButton_Label );
	this.tabUI_Sizer.add( this.preferencesButton );
	this.tabUI_Sizer.addStretch();
	this.tabUI_Sizer.add( this.reprocessButton_Label );
	this.tabUI_Sizer.add( this.reprocessButton );
	this.tabUI_Control.sizer.scaledSpacing = 8;
	this.tabUI_Control.sizer.add(this.tabUI_Sizer);
	
	// advanced parameters
	this.tabAdvanced_Section = new SectionBar( this, "Advanced Parameters" );
	this.tabAdvanced_Control = new Control( this );
	this.tabAdvanced_Section.setSection( this.tabAdvanced_Control );
	this.tabAdvanced_Control.sizer = new VerticalSizer;
	this.tabAdvanced_Control.sizer.scaledSpacing = 8;
	this.tabAdvanced_Control.sizer.add( this.pathButton_Sizer );
	if ( this.selectAI_Sizer ) this.tabAdvanced_Control.sizer.add(this.selectAI_Sizer);
	
	// Add create instance button
	this.newInstanceButton = new ToolButton( this );
	this.newInstanceButton.icon = this.scaledResource( ":/process-interface/new-instance.png" );
	this.newInstanceButton.setScaledFixedSize( 24, 24 );
	this.newInstanceButton.toolTip = "New Instance";
	this.newInstanceButton.onMousePress = () => {
		// stores the parameters
		GraXpert4PixParams.save();
		// create the script instance
		this.newInstance();
	};
	this.newInstanceButton.onMouseRelease = () => {
		// close dialog
		this.ok();
	};

	// save Parameters
	this.saveButton = new ToolButton( this );
	this.saveButton.icon = this.scaledResource( ":/icons/save.png" );
	this.saveButton.setScaledFixedSize( 24, 24 );
	this.saveButton.toolTip = "<p>Save script preferences.</p>";
	this.saveButton.onClick = () => {
		// save preferences
		Console.writeln("Save preferences.");
		GraXpert4PixParams.savePreferences();
		this.updateButtons();
	};
	
	// execute
	this.execButton = new PushButton( this );
	this.execButton.text = "Execute";
	this.execButton.icon = this.scaledResource( ":/icons/ok.png" );
	this.execButton.onClick = () => {
		// check if a valid target view has been selected
		if (targetView && targetView.id) {
			// save preferences
			GraXpert4PixParams.savePreferences();
			
			// close dialog
			this.ok();

			// perform GraXpert
			engine.execute(targetView);

		} else {
			// display warning
			Console.show();
			Console.warningln("No target view is specified ");
		};
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
		Console.writeln("Reset preferences to default values.");
		GraXpert4PixParams.reset();
		this.updateButtons();
	};
	
	// help
	this.helpButton = new ToolButton( this );
	this.helpButton.icon = this.scaledResource(":/process-interface/browse-documentation.png");
	this.helpButton.setScaledFixedSize( 24, 24 );
	this.helpButton.toolTip = "<p>Browse Documentation.</p>";
	this.helpButton.onClick = () => {
		if (!Dialog.browseScriptDocumentation(TITLE)) {
			let mb = new MessageBox(
				"<p>Documentation has not been installed.</p>",
				TITLE,
				StdIcon_Warning,
				StdButton_Ok
			);
			mb.execute();
		};
	};
	
	// create a horizontal slider to layout the execution button
	this.execButtonSizer = new HorizontalSizer;
	this.execButtonSizer.margin = 0;
	this.execButtonSizer.spacing = 4;
	this.execButtonSizer.add(this.newInstanceButton);
	this.execButtonSizer.addStretch();
	this.execButtonSizer.add( this.saveButton );
	this.execButtonSizer.add( this.execButton );
	this.execButtonSizer.add( this.cancelButton );
	this.execButtonSizer.add( this.resetButton );
	this.execButtonSizer.add( this.helpButton );
	
	// layout the dialog
	this.sizer = new VerticalSizer;
	this.sizer.margin = 8;
	this.sizer.add(this.title);
	this.sizer.addSpacing(8);
	this.sizer.add(this.viewList);
	this.sizer.addSpacing(8);
	this.sizer.add(this.selectCorrection_Sizer);
	this.sizer.addSpacing(8);
	this.sizer.add(this.smoothing_Sizer);
	this.sizer.addSpacing(8);
	this.sizer.add(this.selectCreate_Sizer);
	this.sizer.addSpacing(16);
	this.sizer.add(this.tabUI_Section);
	this.sizer.addSpacing(8);
	this.sizer.add(this.tabUI_Control);
	this.sizer.addSpacing(8);
	this.sizer.add(this.tabAdvanced_Section);
	this.sizer.addSpacing(8);
	this.sizer.add(this.tabAdvanced_Control);
	this.sizer.addSpacing(8);
	this.sizer.add(this.execButtonSizer);
	this.sizer.addStretch();
	
	// update dialog with settings
	this.updateButtons();
	
	// set dialog height
	this.setVariableHeight();
	this.adjustToContents();
	this.setFixedHeight();
};

GraXpert4PixDialog.prototype = new Dialog;

#endif	// __GRAXPERT_ALL_IN_ONE_DIALOG__