Yet Another PixInsight script for GraXpert !

GraXpert is an astronomical image processing program for extracting and removing gradients from the background of your astrophotos.
GraXpert4PixInsight help you to run GraXpert from PixInsiht, retrieve result file and restore astrometic data from original photo.

Several options are available
- Select target view from drop down list or new instance button (triangle on bottom left).
- Select AI version assuming several AI models installed on your system by GraXpert (refer [GraXpert web site](https://www.graxpert.com/)).
- Select correction mode (Substraction or Division, GraXpert use Substraction by default).
- Select smoothing (0 to 1, default 0 recommended for AI).
- GraXpet result can replace target view or create a new view (default).
- Activate debug mode (by default GraXpert4PixInsight will display GraXpert logs in PixInsight console only in case of error detected).
- Possibility to import background in PixInsight (require GraXpert version v2.1.1).
- Current parameters are saved as preferences on each execution.
- Reset preferences to default values (path to GraXpert application can optionnaly be reseted as well).
- Creation of process icon by drag and drop new instance button (triangle on bottom left).
- Select target view by drag and drop new instance button (triangle on bottom left).
- Pause/Abort GraXpert execution by using Pause/Abort console button.
- Possibility to launch GraXpert UI from script dialog box.

Important notes:
- GraXpert4PixInsight v1.0.0 requires GraXpert v2.2.0 or higher.
- GraXpert4PixInsight v1.0.0 is not compatible with GraXpert v2.0.2.

For any issue with GraXpert4PixInsight open an issue [here](https://github.com/AstroDeepSky/GraXpert4PixInsight/issues).


# Installation
1. Install latest official version of GraXpert
	- Download available [here](https://github.com/Steffenhir/GraXpert/releases/latest)
2. Install GraXpert4PixInsight in PixInsight
	- Copy GraXpert4PixInsight src and rsc folders in PixInsight folder.
	- From PixInsight, select Menu SCRIPT > Feature scripts…
	- Click Add and select folder C:/Program Files/PixInsight/src/scripts/PixGraXpert (adapt path for osMac and Linux).
	- Click Ok and Done to finalize the installation.
3. Run GraXpert4PixInsight script from PrixInsight
	- From PixInsight menu SCRIPT > Utilities > GraXpert
	- On first laucnch select path to GraXpert application (refer step 1)


## Running GraXpert script
From PixInsight
1. Open a photo
2. Run script SCRIPT > Utilities > GraXpert
3. Select target photo
4. Click on execute
Script will launch Gradien Extraction and display result.


## Trouble shooting
In case of problem, activate debug option in dialog box parameters and post issue [https://github.com/AstroDeepSky/GraXpert4PixInsight/issues](here) with a copy of logs from PixInsight console.
