import React, { Component, PureComponent} from 'react';
import { createSelector } from 'reselect'

import { Connect } from './utils/Connect';
import * as BackOfficeStatus from '@bo/BackOfficeStatus';

import './FitsViewerWithAstrometry.css';
import FitsViewerInContext, {UnmappedFitsViewerInContext} from './FitsViewerInContext';
import SkyProjection from './utils/SkyProjection';
import * as Store from './Store';
import { SucceededAstrometryResult } from '@bo/ProcessorTypes';


type InputProps = {
    app: any;
    src: string;
    contextKey: string;
};

type AstrometryProps = {
    visible: boolean;
    narrowable: boolean;
    status: BackOfficeStatus.AstrometryStatus["status"] | BackOfficeStatus.AstrometryStatus["scopeStatus"];
    error: string | null;
    cancel: boolean;
    move: boolean;
    sync: boolean;
    start: boolean;
    trackScope: string|null;
    ranow: number|null;
    decnow: number|null;
};

type LiveProps = {
    scopeDeltaRa: number|null;
    scopeDeltaDec: number|null;
};

type MappedProps = AstrometryProps & LiveProps;

type Props = InputProps & MappedProps;

type State = {
    fs: boolean;
}

class FitsViewerWithAstrometry extends React.PureComponent<Props, State> {
    private readonly fitsViewer = React.createRef<UnmappedFitsViewerInContext>();

    constructor(props:Props) {
        super(props);
        this.state = {fs: false};
    }

    private readonly cancel = async () => {
        return await this.props.app.appServerRequest('astrometry', {
            method: 'cancel'
        });
    }

    private readonly move = async (pos:any) => {
        const state = Store.getStore().getState();
        const astrometryResult = state.backend.astrometry!.result;
        console.log('move at ', pos);
        if (pos.imageX === undefined || pos.imageY === undefined) {
            throw new Error("Wrong image position");
        }
        if (astrometryResult === null) {
            throw new Error("No astrometry result");
        }

        const skyProjection = SkyProjection.fromAstrometry(astrometryResult as SucceededAstrometryResult);
        // take the center of the image
        const center = [pos.imageX, pos.imageY];
        // Project to J2000
        const [ra2000, dec2000] = skyProjection.pixToRaDec(center);
        // compute JNOW center for last image.
        const [ranow, decnow] = SkyProjection.raDecEpochFromJ2000([ra2000, dec2000], Date.now());

        const gotoRequest:BackOfficeStatus.AstrometryGotoScopeRequest = {
            ra: ranow,
            dec: decnow,
        };

        return await this.props.app.appServerRequest('astrometry', {
            method: 'goto',
            ...gotoRequest
        });
    }

    private readonly sync = async () => {
        const syncRequest:BackOfficeStatus.AstrometrySyncScopeRequest = {
        };

        return await this.props.app.appServerRequest('astrometry', {
            method: 'sync',
            ...syncRequest
        });
    }

    private readonly start=async (forceWide?:boolean)=>
    {
        const computeRequest:BackOfficeStatus.AstrometryComputeRequest = {
            image: this.props.src,
            forceWide:!!forceWide
        };

        return await this.props.app.appServerRequest('astrometry', {
            method: 'compute',
            ...computeRequest
        });
    }

    private readonly startWide = () => {
        return this.start(true);
    }

    private readonly toggleFs = () => {
        this.setState({fs: !this.state.fs});
    }

    private readonly contextMenuSelector = createSelector(
            [
                (m:MappedProps)=>m.start,
                (m:MappedProps)=>m.narrowable,
                (m:MappedProps)=>m.move
            ],
            (start, narrowable, move)=> {
                const ret:any[] = [{
                    title: 'Toggle fullscreen',
                    key: 'fullscreen',
                    cb: this.toggleFs,
                }];
                if (start) {
                    if (narrowable) {
                        ret.push({
                            title: 'Astrometry',
                            key: 'astrometry',
                            cb: this.start
                        });
                        ret.push({
                            title: 'Astrometry (Wide)',
                            key: 'astrometry',
                            cb: this.startWide
                        });
                    } else {
                        ret.push({
                            title: 'Astrometry (Wide)',
                            key: 'astrometry',
                            cb: this.startWide
                        });
                    }
                }
                if (move) {
                    ret.push({
                        title: 'Goto here',
                        key: 'goto',
                        cb: this.move,
                        positional: true,
                    });
                }
                return ret;
            }
    );

    titleForStatus(status:BackOfficeStatus.AstrometryStatus["status"]|BackOfficeStatus.AstrometryStatus["scopeStatus"])
    {
        return "Astrometry " + status;
    }

    static deltaTitle(dlt:number) {
        if (dlt === 0) {
            return '0"';
        }

        let rslt;
        if (dlt < 0) {
            rslt = '-';
            dlt = -dlt;
        } else {
            rslt = '+';
        }

        if (dlt >= 3600) {
            rslt += Math.floor(dlt / 3600) + '°';
        }

        if (dlt >= 60 && dlt < 2*3600) {
            rslt += (Math.floor(dlt / 60) % 60) + "'";
        }

        if (dlt < 120) {
            rslt += (dlt % 60) + '"';
        }
        return rslt;
    }

    render() {
        return <div className={"FitsViewer FitsViewContainer" + (this.state.fs ? " FitsViewFullScreen" : "")}>
            <FitsViewerInContext contextKey={this.props.contextKey}
                        src={this.props.src}
                        app={this.props.app}
                        ref={this.fitsViewer}
                        contextMenu={this.contextMenuSelector(this.props)}
                />
            <span className="AstrometryImageInfoRoot">
                {this.props.scopeDeltaRa !== null ? "Δ Ra/Dec: " + FitsViewerWithAstrometry.deltaTitle(this.props.scopeDeltaRa!) + "  " + FitsViewerWithAstrometry.deltaTitle(this.props.scopeDeltaDec!)  : null}
                {this.props.visible && this.props.scopeDeltaRa === null ? this.titleForStatus(this.props.status) : null}
                {this.props.cancel ? <input type='button' className='AstrometryBton' value='Abort' onClick={this.cancel}/> : null}
                {this.props.sync && this.props.scopeDeltaRa !== 0 && this.props.scopeDeltaDec !== 0 ? <input type='button' className='AstrometryBton' value='Sync' onClick={this.sync}/> : null}
                {this.props.error !== null
                    ? <div className="Error">{this.props.error}</div>
                    : null
                }
            </span>
        </div>;
    }

    static mapStateToProps():(store:any, ownProps: InputProps)=>MappedProps {

        const selector = createSelector (
            [(store:any)=>store.backend.astrometry, (store:any, ownProps:InputProps)=>ownProps.src],
            (astrometry:BackOfficeStatus.AstrometryStatus, src:string):AstrometryProps =>  {
                if (astrometry === undefined) {
                    return {
                        status: "empty",
                        visible: false,
                        narrowable: false,
                        cancel: false,
                        move: false,
                        sync: false,
                        start: false,
                        error: null,
                        trackScope: null,
                        ranow : null,
                        decnow: null,
                    }
                }
                const computeStatus = astrometry.status;
                const scopeStatus = astrometry.scopeStatus;
                const result: AstrometryProps = {
                    status: computeStatus,
                    narrowable: (astrometry.narrowedField !== null || astrometry.useNarrowedSearchRadius),
                    visible: true,
                    cancel: false,
                    move: false,
                    sync: false,
                    start: false,
                    error: null,
                    trackScope: null,
                    ranow: null,
                    decnow: null,
                };

                const calcTrackScope=()=>{
                    if (astrometry.image !== null && astrometry.image === src
                        && astrometry.status === "ready"
                        && astrometry.result !== null && astrometry.result.found ) {

                        result.trackScope = astrometry.selectedScope;

                        if (astrometry.target === null) {
                            const skyProjection = SkyProjection.fromAstrometry(astrometry.result);
                            // take the center of the image
                            const center = [(astrometry.result.width - 1) / 2, (astrometry.result.height - 1) / 2];
                            // Project to J2000
                            const [ra2000, dec2000] = skyProjection.pixToRaDec(center);
                            // compute JNOW center for last image.
                            const [ranow, decnow] = SkyProjection.raDecEpochFromJ2000([ra2000, dec2000], Date.now());

                            result.ranow = ranow;
                            result.decnow = decnow;
                        } else {
                            result.ranow = astrometry.target.ra;
                            result.decnow = astrometry.target.dec;
                        }
                    }
                }
                if (scopeStatus === "moving" || scopeStatus === "syncing") {
                    result.cancel = true;
                    result.status = scopeStatus;
                    calcTrackScope();
                } else if (computeStatus === "computing") {
                    result.cancel = true;
                    result.status
                } else {
                    if (astrometry.image !== null && astrometry.image === src)
                    {
                        switch(astrometry.status) {
                            case "empty":
                            case "error":
                                result.start = true;
                                break;
                            case "ready":
                                if (astrometry.result !== null && astrometry.result.found) {
                                    result.move = astrometry.scopeReady;
                                    result.sync = astrometry.scopeReady && !astrometry.scopeMovedSinceImage;
                                    calcTrackScope();
                                } else {

                                    result.start = true;
                                    result.error = "failed";
                                }
                                break;
                        }
                    } else {
                        result.start = true;
                        result.visible = false;
                    }
                }

                if (astrometry.image !== null && astrometry.image === src) {
                    if (astrometry.lastOperationError !== null) {
                        result.error = astrometry.lastOperationError;
                    } else if (astrometry.scopeDetails !== null) {
                        result.error = astrometry.scopeDetails;
                    }
                }
                return result;
            });

        return (store:any, ownProps:InputProps):MappedProps=>{
            const astrometryProps = selector(store, ownProps);
            const liveProps: LiveProps = { scopeDeltaRa:null, scopeDeltaDec:null};
            if (astrometryProps.trackScope) {
                try {
                    const coordNode = store.backend.indiManager.deviceTree[astrometryProps.trackScope].EQUATORIAL_EOD_COORD;
                    const ra = 360 * parseFloat(coordNode.childs.RA.$_) / 24;
                    const dec = parseFloat(coordNode.childs.DEC.$_);

                    const deltaRa = Math.round((astrometryProps.ranow! - ra) * 3600);
                    const deltaDec = Math.round((astrometryProps.decnow! - dec) * 3600);

                    liveProps.scopeDeltaRa = deltaRa;
                    liveProps.scopeDeltaDec = deltaDec;
                } catch(e) {
                    console.log('ignoring : ', e);
                }
                console.log('liveProps', liveProps);
            }
            return {
                ...liveProps,
                ...astrometryProps
            };
        }
    }
};

export default Connect<FitsViewerWithAstrometry, InputProps, {}, MappedProps>(FitsViewerWithAstrometry);
