import xml.etree.ElementTree as ET
import zipfile
import os
import hashlib
import shutil
import re
from datetime import datetime

def extract_version(filename):
    with open(filename, 'r') as file:
        content = file.read()

    pattern = re.compile(r'#define VERSION "v(\d+\.\d+\.\d+)"')
    match = pattern.search(content)
    
    if not match:
        raise ValueError("Version not found")
    
    return match.group(1)

def extract_version_changelog(filename, start_marker='-', end_marker='-'):
    with open(filename, 'r') as file:
        content = file.read()

    pattern = re.compile(r"\d{2}/\d{2}/\d{4} v(\d+\.\d+\.\d+)(.*?)\d{2}/\d{2}/\d{4}", re.DOTALL)
    match = pattern.search(content)

    if not match:
        raise ValueError("Change log extract failed")

    version = match.group(1).strip()
    changelog = re.sub(r'(^[\s-]*$\n?)', '', match.group(2).strip(), flags=re.MULTILINE)

    return version, changelog

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

def save_list_to_zip(files_list, script_folder, output_directory):
    try:
        # check path
        local_files = []
        for file in files_list:
            if file == '':
                continue
            elif (not file.startswith(f"src/scripts/{script_folder}/") and not file.startswith(f"doc/scripts/")):
                raise Exception(f"Invalid path {file}")
            elif not os.path.exists(file) and not file.startswith("src/scripts/GraXpertSuite/GXS"):
                print(f"Delete '{file}'")
            elif not os.path.exists(file) and file.startswith("src/scripts/GraXpertSuite/GXS"):
                raise Exception(f"File '{file}' not found.")
            elif file in local_files:
                raise Exception(f"Duplicate file '{file}'")
            else:
                local_files.append(file)
        
        # define eip file name
        zip_file = f"{script_folder}.zip"
        
        # build zip for standard install
        date_prefix = datetime.now().strftime("%Y%m%d")
        zip_file_date = f"{date_prefix}_{zip_file}"
        print(f"\nBuild {zip_file_date} for automatic install")
        zip_file_path = os.path.join(output_directory, zip_file_date)
        with zipfile.ZipFile(zip_file_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for file in local_files:
                zipf.write(file)
                print(f"+ {file}")

        # create zip file for manual install
        if os.path.basename(output_directory) == "graxpert":
            manual_zip = "GraXpert-All-In-One.zip"
        else:
            manual_zip = "GraXpert-Suite.zip"
        print(f"\nBuild {manual_zip} for manual install")
        shutil.copy(zip_file_path, os.path.join(output_directory, manual_zip))
        
        return zip_file_path
    except Exception as e:
        raise ValueError(f"{e}")


def replace_and_save(source_path, dest_directory, zip_file_path, changelog):
    # Check if the source file exists
    if not os.path.isfile(source_path):
        print(f"The source file '{source_path}' does not exist.")
        return
    print(f"\nBuild update file from {os.path.basename(source_path)}")
    
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
    
    # Replace changelog
    file_content = file_content.replace("_CHANGELOG_", "Changelog v" + version + ":</p>\n\t\t\t<p>" + changelog.replace("\n", "</p>\n\t\t\t<p>"))

    # Build the destination file path with the same name in the specified directory
    dest_filename = os.path.join(dest_directory, "updates.xri")

    # Write the modified content to the destination file
    with open(dest_filename, 'w') as dest_file:
        dest_file.write(file_content)

    print(f"\n===> {dest_filename}")


if __name__ == "__main__":
    while (1):
        try:
            # extract version from Helper.js
            print("\nGet version and changelog")
            version = extract_version('src/scripts/GraXpertSuite/Helper.js')
            changelog_version, changelog = extract_version_changelog('src/scripts/GraXpertSuite/change-log.txt')
            if changelog_version != version:
                raise ValueError(f"Wrong version (changelog {changelog_version} / Helper.js {version})")

            # create repository
            output_directory = os.path.join("repository", "update-beta")
            if os.path.exists(output_directory):
                shutil.rmtree(output_directory)
            
            # create packages
            for updates_xml_file in ["updates.xri", "updates-suite.xri"]:
                files_list = extract_files_from_remove_section(updates_xml_file)
                destination = os.path.join(output_directory, updates_xml_file.replace("updates", "graxpert").replace(".xri",""))
                os.makedirs(destination, exist_ok=True)
                if files_list:
                    zip_file_path = save_list_to_zip(files_list, "GraXpertSuite", destination)
                    replace_and_save(updates_xml_file, destination, zip_file_path, changelog)
            print("\nRUN PIXINSIGHT CODE SIGNING AGAIN TO SIGN updates.xri FILES")
        except ValueError as ve:
            print(ve)
            print("\nBUILD FAILED!!!")
        input()

