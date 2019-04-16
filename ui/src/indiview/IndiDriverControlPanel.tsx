/**
 * Created by ludovic on 21/07/17.
 */
import React, { Component, PureComponent} from 'react';
import CancellationToken from 'cancellationtoken';
import * as Store from "../Store";
import * as Actions from "../Actions";
import * as BackendRequest from "../BackendRequest";
import * as IndiManagerStore from "../IndiManagerStore";
import * as Utils from "../Utils";
import Modal from '../Modal';
import IndiDriverConfig from '../IndiDriverConfig';
import "./IndiManagerView.css";

type InputProps = {
}

type MappedProps = {
    current: string;
    configured: boolean;
}

type Props = InputProps & MappedProps;

class IndiDriverControlPanel extends React.PureComponent<Props> {
    private readonly modal = React.createRef<Modal>();

    constructor(props:Props) {
        super(props);
    }

    private config = ()=> {
        this.modal.current!.open();
    }
    
    private restart = async ()=> {
        await BackendRequest.RootInvoker("indi")("restartDriver")(CancellationToken.CONTINUE, {driver: this.props.current});
    }

    render() {
        if (this.props.configured) {
            return <span>
                <Modal
                    ref={this.modal}>
                    <IndiDriverConfig driverId={this.props.current} />
                </Modal>
                <input type='button'
                            className='IndiConfigButton'
                            onClick={this.config}
                            value='...'/>
                <input type='button'
                            onClick={this.restart}
                            className='IndiRestartButton'
                            value={'\u21bb'}/>
            </span>
        }
        return null;
    }

    static mapStateToProps(store:Store.Content, props: InputProps):MappedProps {
        const backend = store.backend.indiManager;

        const currentDevice = store.indiManager.selectedDevice || "";

        const configuredDevices = Utils.noErr(()=>backend!.configuration.indiServer.devices, undefined);
        const configured = (configuredDevices && Object.prototype.hasOwnProperty.call(configuredDevices, currentDevice));

        return {
            current: currentDevice,
            configured: configured
        };
    }
}

export default Store.Connect(IndiDriverControlPanel);
