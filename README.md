Yet Another PixInsight script for GraXpert !

GraXpert is an astronomical image processing program for extracting and removing gradients from the background of your astrophotos.
GraXpert4Pix help you to run GraXpert from PixInsiht, retrieve result file and restore astrometic data from original photo.

Several options available
- Select target view from drop down list or ne instance button (triangle on bottom left)
- Select AI version assuming AI models istalled on your system by GraXpert
- Select correction mode (Substraction or Division, GraXpert use Substraction by default)
- Select smoothing (0 to 1, default 0.5)
- Result replace target view or create a new view (default)
- Activate debug mode (by default GraXpert4Pix will display only GraXpert errors in PixInsight console)
- Current parameters are saved as preferences on each execution
- Reset preferences to default values (path to GraXpert application can optionnaly be reseted as well)
- Creation of process icon by drag and drop new instance button (triangle on bottom left)
- Select target view by drag and drop new instance button (triangle on bottom left)
- Pause/Abort GraXpert execution by using Pause/Abort console button

Important notes:
- On Windows, GraXpert splatch window hide PixInsight Pause/Abort pop-up. You have to press Enter even though you don't have access to the pop-up.
- I never tested GraXpert4Pix on Mac or Linux system. Feedbacks are welcome.
- Please report any issue with GraXpert4Pix or integraton with GraXpert here.


# Installation
1. Install latest official version of GraXpert
	- Download available [here](https://github.com/Steffenhir/GraXpert/releases/latest)
2. Run GraXpert application
	- Get more information from [www.graxpert.com](https://www.graxpert.com/)
3. Process a photograpie using AI Interpolation Method.
	- This will download and install AI model(s).
3. Copy GraXpert4Pix src and rsc folders in PixInsight folder.
	- Package avalable here
4. Install GraXpert4Pix in PixInsight
	- From PixInsight, select Menu SCRIPT > Feature scripts…
	- Click Add and select folder C:/Program Files/PixInsight/src/scripts/PixGraXpert (adapt path for osMac and Linux).
	- Click Ok and Done to finalize the installation.
5. Run GraXpert4Pix scrpt from PrixInsight
	- From PixInsight menu SCRIPT > Utilities > GraXpert
6. Select path to GraXpert application
	- Path will depend on your system (refer step 1)


## Running GraXpert script
From PixInsight
1. Open a photo
2. Run script SCRIPT > Utilities > GraXpert
3. Select target photo
4. Click on execute
Script will launch Gradien Extraction and display result.


## Trouble shooting
In case of problem, activate debug option in dialog box parameters and post issue here with a copy of PixInsight console logs.
