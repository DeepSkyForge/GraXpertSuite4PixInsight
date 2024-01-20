Yet Another PixInsight script for GraXpert !

GraXpert is an astronomical image processing program for extracting and removing gradients from the background of your astrophotos.
GraXpertSuite4PixInsight help you to run GraXpert from PixInsiht, retrieve processed file and restore astrometic data from original photo.

# Features
- Select target view from drop down list or new instance drag and drop (triangle on bottom left).
- Select correction mode (Substraction or Division).
- Select smoothing (0 to 1, default 0 recommended for AI).
- Run transparently AI interpolation method from GraXpert.
- Processed image replace target view or create a new view (default).
- Retrieve and display background model in PixInsight.
- Open PixInsight photo in GraXpert for manual processing (all interpolation methods available).
- Import GraXpert processed file and backgroung and restore astrometric data (whatever interpolation method).
- Transparent photo reprocessing using PixInsight parameters and GraXpert UI preferences (interpolation method, grid...). 
- Check GraXpert preferences in one click (no need to open GraXpert).
- Support process icon through drag and drop new instance button (triangle on bottom left).
- Execute process icon in global context open process icon parameters dialog box.
- Select AI version assuming models installed on your system (refer [GraXpert web site](https://www.graxpert.com/)).
- Saved as preferences (manual or automatically after photo processing).
- Reset preferences to default values.
- Debug mode (by default GraXpertSuite4PixInsight will display GraXpert logs in PixInsight console only in case of error detected).

# Requirements
- PixInsight Core version 1.8.9-2 (not tested with previous versions).
- GraXpert version 2.2.1 or higher.

# Installation
1. Install latest official version of GraXpert
	- Download available [here](https://github.com/Steffenhir/GraXpert/releases/latest)
2. Install GraXpertSuite4PixInsight in PixInsight
	- Menu RESOURCES > Updates > Manage Repositories.
	- Add > URL: https://pixinsight.deepskyforge.com/update/graxpert/ (DON'T FORGET TRAILING SLASH "/").
	- Click OK / OK.
	- Menu RESOURCES > Updates > Check for Updates.
	- You should see an update from pixinsight.deepskyforge.com, click on APPLY.
	- Package should be downloaded, click on OK.
	- Exit PixInsight and confirm install of the updates.
	- A new script should be installed in SCRIPTS > Utilities > GraXpert (All in One)
3. Run GraXpertSuite4PixInsight script from PrixInsight
	- From PixInsight menu SCRIPT > Utilities > GraXpert (All in One).
	- On first laucnch select path to GraXpert application (refer step 1).
	- On first execution GraXpert will download and install AI model (this will delay first image processing).
	- Other AI models can be daownloaded using GraXpert UI (refer [GraXpert web site](https://www.graxpert.com/)).

# Running GraXpert script
From PixInsight
1. Open a photo
2. Run script SCRIPT > Utilities > GraXpert (All in One)
3. Select target photo
4. Click on execute
Script will launch Gradien Extraction and display processed image and background model.

# Updates
1. PixInsight will notify you on each update.

# Trouble shooting and Support
In case of problem, activate debug option in dialog box parameters and post issue [https://github.com/DeepSkyForge/GraXpertSuite4PixInsight/issues](here) with a copy of logs from PixInsight console.
