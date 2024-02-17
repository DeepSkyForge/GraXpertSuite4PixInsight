// ----------------------------------------------------------------------------
// GraXpert Suite for PixInsight (JavaScript Runtime)
// ----------------------------------------------------------------------------
//
// GXSUIProcess.js part of GraXpert Suite for PixInsight
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

#feature-id    GraXpertUIProcess : GraXpert Suite > GXS-UI-Process

#feature-info  GraXpert UI process.<br/>

#define TITLE "GXS-UI-Process"

#include "Helper.js"

function main() {
	// script should not run in global mode
	if (Parameters.isGlobalTarget) {
		let mb = new MessageBox(
				"GraXpert can not run in global context.",
				TITLE,
				StdIcon_Error,
				StdButton_Ok
		);
		mb.execute()
		return
	}
	
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
				"<p><center>No view selected to process GraXpert UI.</center></p>",
				TITLE,
				StdIcon_NoIcon,
				StdButton_Ok
		);
		mb.execute()
		return
	}

	// initialize parameters
	if (!GraXpert4PixParams.init()) {
		return
	}
	
	// create engine
	let engine = new GraXpert4PixEngine()
	
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
	
	// reprocess target view
	engine.execute(targetView, true);
}

main();
