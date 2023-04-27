# Intro
This guide provides information on how to install and use the SDLB visualization tool (v2.1) locally. This is the current only way of using the workflows explorer and it uses a mock backend to serve the ressources using a basic API. Future work will include new way to serve the ressources and will not require the manual setup of the json server. 

The steps to follow include:
- Setting up the project locally
    - Installing dependencies
    - Including statefiles to analyse
    - Generating the database
- Running the json-server
- Running the WebApp development server
# Setting up the project
You can git clone the branch `master-ui-2.1` as it follows the development and ensures the latest features as intended.
## Install dependencies
You will install dependencies for the frontend as well as a few packages used for generating the satefile database.  
### Node
If you don't already have, install node (see [Node js](https://nodejs.org/en)). Then in the project directory, run:
````
$ yarn install
````
### Python
The installation above can take sometime so you might open another terminal and create a python virtual environment (venv). It will be used to run the script that generate a database from the statefiles you want. To do so run:
````
$ pip install virtualenv
$ python<version> -m venv <virtual-environment-name>
````
Then activate the environment using and install the requirements:
````
$ source env/bin/activate
$ pip install -r requirements.txt
````
## Include statefiles
You can create a folder in `/scripts` and put all the statefiles you want to analyse inside of it.
## Generate the database
To do so you can run the python script `script/generate_json_from_statefile.py`. You will be prompted to enter the name of the folder where your statefiles reside. Once you provided the name of the folder the script will bundle the statefiles in one json that will serve as database. The database will be saved in the folder `scripts/outputs` and its name has format ``
# Running the json-server
You know should have installed the node dependencies. You can the run the following command to serve the database your created in the previous step:
````
$ json-server --watch "scripts/output/db_realData_<statefiles folder name>" --port 3001
````
> It is important to specify the port number as otherwise the UI will not be able to fetch the data 

## Issues
In some cases, you will encounter a `json-server command not found`. A possible workaround is to run the json-server directly as a node service. To do so, run the command 
````
$ XYZ
```` 
# Running the WebApp dev server
You can finally start the WebApp on a local development server using
````
$ nvm use node 16
$ yarn start
````
This should automatically open your default browser to `http://localhost:3000` and from there you will be able to use the UI.