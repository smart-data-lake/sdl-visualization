import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import { getUrlContent, listConfigFiles, readConfigIndexFile, readManifestFile, parseTextStrict, standardizeKeys } from "../util/ConfigExplorer/HoconParser";
import { Manifest, useManifest } from "./useManifest";
import { useQuery } from "react-query";

function getConfig(manifest:Manifest) {
  return () => {

    console.log("getConfig Manifest", manifest);

    const baseUrl = window.location.origin + (manifest.baseUrl ?? "/");
    const exportedConfigUrl = baseUrl+"exportedConfig.json";
    const configSubdir = "config";  
    const envConfigSubdir = "envConfig";  
    const configUrl = baseUrl+configSubdir;

    // a) search for exported config in json format
    return getUrlContent(exportedConfigUrl)
    .then(jsonStr => JSON.parse(jsonStr))
    .catch(err => {
      console.log("Could not get exported config in json format "+configUrl+", will try listing hocon config files. ("+err+")");
      // b) parse config from Hocon Files
      console.log("reading config from url "+configUrl);
      // b1) get config file list by listing config directory
      return listConfigFiles(configUrl, "")
      .catch(err => {
        // b2) read config file list from static index.json
        console.log("Could not list files in URL "+configUrl+", will try reading index.json. ("+err+")");
        return readConfigIndexFile(configUrl);
      })
      .then(files => {
        // prepend config directory to files to create relative Url
        const filesRelUrl = files.map(f => configSubdir+"/"+f);
        // add environment config file if existing
        if (manifest.env) {
          const envConfigRelUrl = envConfigSubdir+"/"+manifest.env+".conf";
          // make sure envConfig Url exists
          return getUrlContent(envConfigRelUrl).then(_ => {
            filesRelUrl.push(envConfigRelUrl);
            return filesRelUrl;
          });
        } else {
          return filesRelUrl;
        }
      })
      .then(files => {
        console.log("config files to read", files);
        const includeText = files.map(f => `include "${baseUrl}${f}"`).join("\n");
        return parseTextStrict(includeText);
      })
    })
  }
}

/**
 * The useConfig hook is used to fetch the SDLB config from the backend. The result.data of the query is a large json object.
 */
export function useConfig(manifest?: Manifest) {
  console.log("useConfig", manifest)
  return useQuery({queryKey: 'config', queryFn: getConfig(manifest!), enabled: manifest !== undefined, retry: false, staleTime: 1000 * 60 * 60 * 24}) //24h
}
