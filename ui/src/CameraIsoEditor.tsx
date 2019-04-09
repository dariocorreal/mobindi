import React, { Component, PureComponent} from 'react';
import { connect } from 'react-redux';
import { atPath } from './shared/JsonPath';
import * as Utils from './Utils';
import * as IndiUtils from './IndiUtils';
import * as PromiseSelector from './PromiseSelector';
import * as Store from './Store';

/*
    Unfortunately, iso are stored as meaningless strings. (ISO1, ISO2, ...)


          "CCD_ISO": {
            "$$": "defSwitchVector",
            "$device": "Canon DSLR EOS 450D (PTP mode)",
            "$name": "CCD_ISO",
            "$label": "ISO",
            "$group": "Image Settings",
            "$state": "Ok",
            "$perm": "rw",
            "$rule": "OneOfMany",
            "$timeout": "60",
            "$timestamp": "2017-08-14T07:24:31",
            "$type": "Switch",
            "childs": {
              "ISO0": {
                "$name": "ISO0",
                "$label": "Auto",
                "$_": "Off"
              },
              "ISO1": {
                "$name": "ISO1",
                "$label": "100",
                "$_": "Off"
              },
              "ISO2": {
                "$name": "ISO2",
                "$label": "200",
                "$_": "Off"
              },
              "ISO3": {
                "$name": "ISO3",
                "$label": "400",
                "$_": "Off"
              },
              "ISO4": {
                "$name": "ISO4",
                "$label": "800",
                "$_": "Off"
              },
              "ISO5": {
                "$name": "ISO5",
                "$label": "1600",
                "$_": "On"
              }
            },
            "childNames": [
              "ISO0",
              "ISO1",
              "ISO2",
              "ISO3",
              "ISO4",
              "ISO5"
            ]
          },
*/

type InputProps = {
  // name of the device (indi id)
  device: string;
  // Location of the value in the store
  valuePath: string;
  // Function that build a promises
  setValue: (e:string)=>Promise<void>;
}

type MappedProps = PromiseSelector.Props<string> & {
  valuePath: string;
  $itemCount: number;
} & {
  [id: string]:string;
}

type Props = InputProps & MappedProps;

function IsoValueGenerator(props:Props) {
    const result:string[] = [];
    for(var i = 0; i < props.$itemCount; ++i)
    {
        result.push(props['$item_' + i]);
    }
    
    return result;
}

function IsoTitle(x:string) {
    return "" + x + " iso";
}

const CameraIsoEditor = connect((store:Store.Content, ownProps:InputProps) => {
    const desc = Utils.noErr(()=>IndiUtils.getDeviceDesc(store, ownProps.device)!.CCD_ISO, undefined);

    var root = ({
        placeholder: 'ISO...',
        active: atPath(store, ownProps.valuePath),
        availablesGenerator: IsoValueGenerator,
        getTitle: IsoTitle,
        $itemCount: 0,
    });

    if (!desc) {
        return root;
    }
    
    root.$itemCount = desc.childNames.length;
    for(let i = 0; i < desc.childNames.length; ++i)
    {
        var childId = desc.childNames[i];
        root['$item_' + i]= desc.childs[childId].$label;
    }

    return root;
})(PromiseSelector.default)

export default CameraIsoEditor;