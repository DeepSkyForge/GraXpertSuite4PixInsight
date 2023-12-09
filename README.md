Yet Another PixInsight script for GraXpert !

GraXpert is an astronomical image processing program for extracting and removing gradients from the background of your astrophotos.


# Installation
1. Install latest official version of [GraXpert](https://github.com/Steffenhir/GraXpert/releases/latest)

2. Run GraXpert application
3. Process a photograpie using AI Interpolation Method.
	- This will download and install AI model(s).

3. Copy src and rsc folders in PixInsight folder.

4. From PixInsight, Menu SCRIPT > Feature scripts…
	- Click Add and select folder C:/Program Files/PixInsight/src/scripts/PixGraXpert (adapt path for osMac and Linux).
	- Click Ok and Done to finalize the installation.

5. Run GraXpert script from PixInsight menu SCRIPT > Utilities > GraXpert

6. Select path to GraXpert application.


## Running GraXpert script
From PixInsight
1. Open a photo.
2. Run script SCRIPT > Utilities > GraXpert.
3. Click on execute.

Notes:
- First time you'll have to select path to GraXpert or GradXtract application.
- Script will launch Gradien Extraction and display result.

## Trouble shooting
In case of problem, activate debug option in dialog box parameters and post issue here with a copy of PixInsight console logs.
