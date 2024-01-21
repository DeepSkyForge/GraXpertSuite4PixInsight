import xml.etree.ElementTree as ET
import zipfile
import os
import hashlib
import shutil
from datetime import datetime

def extract_files_from_remove_section(xml_file):
    try:
        # Parse the XML file
        tree = ET.parse(xml_file)
        root = tree.getroot()

        # Find the <remove> section
        remove_section = root.find(".//remove")

        # If the <remove> section is found, retrieve the list of files
        if remove_section is not None:
            # Exclude empty strings from the list
            files_list = [file.strip() for file in remove_section.text.split(",") if file.strip()]
            
            # Check if the list is not empty before returning
            if files_list:
                return files_list
            else:
                raise ValueError("No valid files found in the <remove> section.")
        else:
            raise ValueError("<remove> section not found in the XML.")
    except Exception as e:
        raise ValueError(f"XML Parsing {xml_file}: {e}")

def save_list_to_zip(files_list, zip_file, output_directory):
    try:
        # build zip for manual install
        print("\nBuild zip for manual install")
        zip_file_path = os.path.join(output_directory, zip_file)
        with zipfile.ZipFile(zip_file_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for file in files_list:
                if file == '' or file.endswith('.svg'):
                    continue
                # Check if the file exists
                if os.path.exists(file):
                    # Get the relative path for the file in the zip archive
                    zipf.write(file, os.path.basename(file))
                    print(f"+ {os.path.basename(file)}")
                else:
                    raise FileNotFoundError(f"File '{file}' not found.")

        print("\nBuild zip for automatic install")
        date_prefix = datetime.now().strftime("%Y%m%d")
        zip_file_with_date = f"{date_prefix}_{zip_file}"
        zip_file_path = os.path.join(output_directory, zip_file_with_date)
        with zipfile.ZipFile(zip_file_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for file in files_list:
                if not file.startswith("src/scripts/GraXpertSuite/"):
                    raise Exception(f"Invalid path in file {file} found in updates file")
                if file == '':
                    continue
                # Check if the file exists
                if os.path.exists(file):
                    zipf.write(file, file)
                    print(f"+ {file}")
                else:
                    raise FileNotFoundError(f"File '{file}' not found.")

        return zip_file_path
    except Exception as e:
        raise ValueError(f"{e}")


def replace_and_save(source_path, dest_directory, zip_file_path):
    print("\nBuild update file")
    # Check if the source file exists
    if not os.path.isfile(source_path):
        print(f"The source file '{source_path}' does not exist.")
        return
    print(f"+ Update: {source_path}")
    
    # Check if the source file exists
    if not os.path.isfile(zip_file_path):
        print(f"The source file '{zip_file_path}' does not exist.")
        return
    print(f"+ ZIP file: {zip_file_path}")
    
    # define creation date (YYYYMMDD)
    current_date = datetime.now().strftime("%Y%m%d%H%M%S")
    print(f"+ Date & Time: {current_date}")
    
    # Calculate the SHA1 of the zip file
    sha1 = hashlib.sha1()
    with open(zip_file_path, 'rb') as f:
        for block in iter(lambda: f.read(65536), b''):
            sha1.update(block)
    print(f"+ SHA1 zip file: {sha1.hexdigest()}")

    # Read the content of the source file
    with open(source_path, 'r') as source_file:
        file_content = source_file.read()

    # Replace the _ZIP_FILENAME_ pattern with the zip_file_path value
    file_content = file_content.replace("_ZIP_FILENAME_", os.path.basename(zip_file_path))
    
    # Replace the _SHA1_ pattern with the sha1_pattern value
    file_content = file_content.replace("_SHA1_", sha1.hexdigest())
    
    # Replace the _DATE_ pattern with the current_date value
    file_content = file_content.replace("_DATE_", current_date)

    # Build the destination file path with the same name in the specified directory
    dest_filename = os.path.join(dest_directory, "updates.xri")

    # Write the modified content to the destination file
    with open(dest_filename, 'w') as dest_file:
        dest_file.write(file_content)

    print(f"\n===> {dest_filename}")


if __name__ == "__main__":
    try:
        output_directory = os.path.join("repository", "update-beta")
        if os.path.exists(output_directory):
            shutil.rmtree(output_directory)
        for updates_xml_file in ["updates.xri", "updates-suite.xri"]:
            files_list = extract_files_from_remove_section(updates_xml_file)
            destination = os.path.join(output_directory, updates_xml_file.replace("updates", "graxpert").replace(".xri",""))
            os.makedirs(destination, exist_ok=True)
            if files_list:
                zip_file_path = save_list_to_zip(files_list, "GraXpertSuite.zip", destination)
                replace_and_save(updates_xml_file, destination, zip_file_path)
            shutil.copy(os.path.join(output_directory, "../index.html"), destination)
        shutil.copy(os.path.join(output_directory, "../index.html"), output_directory)
    except ValueError as ve:
        print(ve)
    print()

