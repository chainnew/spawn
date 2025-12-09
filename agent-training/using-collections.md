Guides
Using Collections
In this guide, we will walk through the basics of:

Creating a 
collection
Adding a 
document
 to the 
collection
Searching for relevant 
documents
 within the 
collection
Deleting 
documents
 and 
collections
For an overview of what Collections is, please see Collections.

You can upload a maximum of 100,000 files per collection.

Creating a new collection
You can create a 
collection
 in the xAI Console and navigate to the Collections tab. Make sure you are in the correct team.

Click on "Create new collection" to create a new 
collection
.

Create collection button
You can choose to enable generate embeddings on document upload or not. We recommend leaving the generate embeddings setting to on.

Alternatively, you can create the collection with code:


Python
Other

import os
from xai_sdk import Client
client = Client(
    api_key=os.getenv("XAI_API_KEY"),
    management_api_key=os.getenv("XAI_MANAGEMENT_API_KEY"),
    timeout=3600, # Override default timeout with longer timeout for reasoning models
)
collection = client.collections.create(
    name="SEC Filings", # You can optionally add in model_name and/or chunk_configuration
)
print(collection)
List available Collections
After adding a new collection, we can either see it in xAI Console, or list it via an API request. This example lists all collections available in the team.


Python
Other

# ... Create client
collections = client.collections.list()
print(collections)
View and update the configuration of a Collection
You can view and edit the Collection's configuration by clicking on Edit Collection.

Edit collection button
This opens up the following modal where you can view the configuration and make changes.

Edit collection modal with configuration
To view the collection's configuration with code:


Python
Other

# ... Create client
collection = client.collections.get("collection_dbc087b1-6c99-493d-86c6-b401fee34a9d")
print(collection)
To update the collection's configuration:


Python
Other

# ... Create client
collection = client.collections.update(
    "collection_dbc087b1-6c99-493d-86c6-b401fee34a9d",
    name="SEC Filings (New)"
)
print(collection)
Adding a document to the collection in xAI Console
Once you have created the new 
collection
. You can click on it in the collections table to view the 
documents
 included in the 
collection
.

Collections table showing a newly created collection with options to view documents
Click on "Upload document" to upload a new 
document
.

Upload document button in collections interface
Once the upload has completed, each document is given a File ID. You can view the File ID, Collection ID and hash of the 
document
 by clicking on the 
document
 in the documents table.

Documents table showing uploaded files with file IDs and collection information
Document details modal showing file ID, collection ID, and file hash
You can also upload documents via code:

Python


# ... Create client
with open("tesla-20241231.html", "rb") as file:
    file_data = file.read()
document = client.collections.upload_document(
    collection_id="collection_dbc087b1-6c99-493d-86c6-b401fee34a9d", # The collection ID of the collection we want to upload to
    name="tesla-20241231.html", # The name that you want to use
    data=file_data, # The data payload
    content_type="text/html",
)
print(document)
Searching for relevant documents within the collection
To search for relevant 
documents
 within one or multiple 
collections
, obtain the Collection ID(s) of the collections that you want to search within first. Then, you can follow this example:


Python
Other

# ... Create client
response = client.collections.search(
    query="What were the key revenue drivers based on the SEC filings?",
    collection_ids=["collection_dbc087b1-6c99-493d-86c6-b401fee34a9d"],
)
print(response)
Deleting documents and collections
You can delete the 
documents
 and 
collections
 on xAI Console by clicking on the more button on the right side of the collections or documents table.

More options menu showing delete collection action
More options menu showing delete document action
To remove a document via code:


Python
Other

# ... Create client
client.collections.remove_document(
    collection_id="collection_dbc087b1-6c99-493d-86c6-b401fee34a9d",
    file_id="file_55a709d4-8edc-4f83-84d9-9f04fe49f832",
)
To remove the collection:


Python
Other

# ... Create client
client.collections.delete(collection_id="collection_dbc087b1-6c99-493d-86c6-b401fee34a9d")
