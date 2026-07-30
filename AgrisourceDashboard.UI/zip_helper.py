import zipfile
import os

files_to_zip = ['package.json', 'package-lock.json', 'server.js']
folders_to_zip = ['dist']

zip_path = 'deploy.zip'
if os.path.exists(zip_path):
    os.remove(zip_path)

with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
    for f in files_to_zip:
        if os.path.exists(f):
            zipf.write(f, f)
            print(f"Added file: {f}")
    for folder in folders_to_zip:
        for root, dirs, files in os.walk(folder):
            for file in files:
                filepath = os.path.join(root, file)
                # Convert backslashes to forward slashes for Linux compatibility
                arcname = filepath.replace('\\', '/')
                zipf.write(filepath, arcname)
                print(f"Added folder file: {arcname}")
print("ZIP file created successfully with forward slashes.")
