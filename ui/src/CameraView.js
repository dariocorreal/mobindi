import React, { Component, PureComponent} from 'react';
import PropTypes from 'prop-types';
import { notifier, BackendStatus } from './Store';
import { connect } from 'react-redux';
import FitsViewer from './FitsViewer';
import PromiseSelector from './PromiseSelector';
import CameraSettingsView from './CameraSettingsView';
import DeviceConnectBton from './DeviceConnectBton';
import './CameraView.css'


const CameraSelector = connect((store)=> ({
            active: store.backend.camera.selectedDevice,
            availables: store.backend.camera.availableDevices
}))(PromiseSelector);

class CameraView extends PureComponent {

    constructor(props) {
        super(props);
        this.state = {url: 'test.jpg'};
        this.next = this.next.bind(this);
        this.shoot = this.shoot.bind(this);
        this.connect = this.connect.bind(this);
    }

    render() {
        //var self = this;
        return(<div className="CameraView">
            <div>
                <CameraSelector setValue={(e)=>this.props.app.serverRequest({method: 'setCamera', data: {device: e}})}/>
                <DeviceConnectBton
                        activePath={'backend/camera/selectedDevice'.split('/')}
                        app={this.props.app}/>
            </div>
            <CameraSettingsView
                settingsPath={'backend/camera/currentSettings'.split('/')}
                activePath={'backend/camera/selectedDevice'.split('/')}
                setValue={(propName)=>((v)=>this.props.app.serverRequest({method: 'setShootParam', data: {key: propName, value: v}}))}
                />
            <div className="FitsViewer FitsViewContainer">
                <FitsViewer src={this.state.url}/>
            </div>
            <div className="ButtonBar">
                <input type="button" onClick={this.shoot} value="Shoot"/>
                <input type="button" onClick={this.next} value="next"/>
            </div>
        </div>);
    }

    shoot() {
        var self = this;
        this.props.app.serverRequest({
            method: 'shoot'
        }).then((rslt)=>
        {
            console.log('got rslt:' + JSON.stringify(rslt));
            self.setState({url : 'fitsviewer/fitsviewer.cgi?path=' + encodeURIComponent(rslt.path)});
        }).start();
    }

    connect() {
        var self = this;
        this.props.app.serverRequest({
            method: 'connect'
        }).then((rslt)=>
        {
            console.log('got rslt:' + JSON.stringify(rslt));
        }).start();
    }

    next() {
        this.setState({url: this.state.url != 'test.jpg' ? 'test.jpg' : 'http://127.0.0.1:18080/plop.png'});
    }

}


export default CameraView;