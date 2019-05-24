import CancellationToken from 'cancellationtoken';
import { ExpressApplication, AppContext } from "./ModuleBase";
import { BackofficeStatus, FilterWheelStatus} from './shared/BackOfficeStatus';
import JsonProxy, { TriggeredWildcard, NoWildcard } from './JsonProxy';
import { hasKey, deepCopy } from './Obj';
import { DriverInterface, Vector } from './Indi';
import {Task, createTask} from "./Task.js";
import * as Obj from "./Obj";
import * as RequestHandler from "./RequestHandler";
import * as BackOfficeAPI from "./shared/BackOfficeAPI";

export default class FilterWheel
        implements RequestHandler.APIAppProvider<BackOfficeAPI.FilterWheelAPI>
{
    appStateManager: JsonProxy<BackofficeStatus>;
    switchPromises: {[filterWheelId: string]:Task<void>};
    currentStatus: FilterWheelStatus;
    context: AppContext;
    get indiManager() { return this.context.indiManager };

    constructor(app:ExpressApplication, appStateManager:JsonProxy<BackofficeStatus>, context:AppContext) {
        this.appStateManager = appStateManager;
        this.appStateManager.getTarget().filterWheel = {
            availableDevices: [],
            dynStateByDevices: {},
        };

        // Device => promise
        this.switchPromises = {};
        this.currentStatus = this.appStateManager.getTarget().filterWheel;
        this.context = context;

        // Update available filterwheels
        context.indiManager.createDeviceListSynchronizer((devs:string[])=> {
            this.currentStatus.availableDevices = devs;
        }, undefined, DriverInterface.FILTER);

        // Update dynState for each filterwheels
        this.appStateManager.addSynchronizer(
            [ 'filterWheel', 'availableDevices' ],
            ()=> {
                const dynStateRoot = this.currentStatus.dynStateByDevices;
                for(const o of this.currentStatus.availableDevices) {
                    if (!Obj.hasKey(dynStateRoot, o)) {
                        dynStateRoot[o] = {
                            targetFilterPos: null,
                            currentFilterPos: null,
                            filterIds: [],
                        }
                    }
                }
            },
            true);
        
        // Compute available filter list
        this.appStateManager.addSynchronizer(
            [
                [
                    [ 'filterWheel', 'availableDevices' ],
                    [ 'filterWheel', 'dynStateByDevices', null ],
                    [ 'indiManager', 'deviceTree', null, 'FILTER_NAME' ],
                    [ 'indiManager', 'deviceTree', null, 'FILTER_SLOT', 'childs', 'FILTER_SLOT_VALUE', [['$min'],['$max']] ],
                ]
            ],
            this.updateFilterIdsForSomeFilterWheels,
            true,
            true
        )

        // Compute current filter
        this.appStateManager.addSynchronizer(
            [
                [
                    [ 'indiManager', 'deviceTree', null, 'FILTER_SLOT', 'childs', 'FILTER_SLOT_VALUE', '$_' ],
                    [ 'filterWheel', 'dynStateByDevices', null ],
                ]
            ],
            this.updateCurrentFilterPosForSomeFilterWheels,
            true,
            true,
        );
        this.indiManager.createMultiPreferredDeviceSelector({
            availablePreferedCurrentPath:
                [
                    [
                        ['filterWheel', 'availableDevices'],
                        ['camera', 'configuration', 'deviceSettings', null, 'preferedFilterWheelDevice'],
                        ['camera', 'dynStateByDevices', null, 'filterWheelDevice']
                    ]
                ]
            ,
            list:()=>Object.keys(this.context.camera.currentStatus.dynStateByDevices),
            read:(camId:string)=>{
                const camStatus = this.context.camera.currentStatus;
                if (!hasKey(camStatus.dynStateByDevices, camId)) {
                    return null;
                }
                if (!hasKey(camStatus.configuration.deviceSettings, camId)) {
                    return null;
                }
                return {
                    available: this.currentStatus.availableDevices,
                    current: camStatus.dynStateByDevices[camId].filterWheelDevice || null,
                    prefered: camStatus.configuration.deviceSettings[camId].preferedFilterWheelDevice || null,
                }
            },
            set:(camId: string, values) => {
                const camStatus = this.context.camera.currentStatus;
                if (values.current !== undefined) {
                    camStatus.dynStateByDevices[camId].filterWheelDevice = values.current;
                }
                if (values.prefered !== undefined) {
                    camStatus.configuration.deviceSettings[camId].preferedFilterWheelDevice = values.prefered;
                }
            }
        });
    }

    private updateCurrentFilterPos=(deviceId:string)=> {
        if (!hasKey(this.currentStatus.dynStateByDevices, deviceId)) {
            return null;
        }
        let pos:number|null = null;
        try {
            const device = this.indiManager.getValidConnection().getDevice(deviceId);

            const slotVec = device.getVector('FILTER_SLOT').getVectorInTree();
            if (slotVec !== null) {
                pos = parseInt(slotVec.childs.FILTER_SLOT_VALUE.$_, 10);
                if (isNaN(pos)) {
                    pos = null;
                }
            }
        } catch(e) {
        }
        this.currentStatus.dynStateByDevices[deviceId].currentFilterPos = pos;
    }

    private updateCurrentFilterPosForSomeFilterWheels=(wildcards:TriggeredWildcard)=> {
        const idList = wildcards[NoWildcard]
            ? Object.keys(this.currentStatus.dynStateByDevices)
            : Object.keys(wildcards);

        for(const id of idList) {
            this.updateCurrentFilterPos(id);
        }
    }

    // Un filter id est soit un chiffre (parseInt) soit #filterId
    private computeFilterIds= (deviceId:string)=> {
        const ret: string[] = [];
        const device = this.indiManager.getValidConnection().getDevice(deviceId);

        const nameVec = device.getVector('FILTER_NAME').getVectorInTree();
        if (nameVec != null) {
            const occ : {[id:string]:number} = {};
            for(const id of nameVec.childNames) {
                const value = nameVec.childs[id].$_;
                const filterId = "#" + value.replace(/#/g, '_');
                
                if (!hasKey(occ,filterId)) {
                    occ[filterId] = 1;
                    ret.push(filterId);
                } else {
                    occ[filterId]++;
                    ret.push(filterId + ' #' + occ[filterId]);
                }
            }
        } else {
            // Just trust the slots
            const slotVec = device.getVector('FILTER_SLOT').getVectorInTree();
            
            if (slotVec !== null && slotVec.childs['FILTER_SLOT_VALUE']) {
                const value = slotVec.childs['FILTER_SLOT_VALUE']
                const min = parseInt(value.$min!);
                const max = parseInt(value.$max!);
                if (!isNaN(min) && !isNaN(max)) {
                    for(let i = min; i < max; ++i) {
                        ret.push("" + i);
                    }
                }
            }
        }
        return ret;
    }

    private updateFilterIds=(fwId: string)=> {
        if (!hasKey(this.currentStatus.dynStateByDevices, fwId)) {
            return null;
        }
        let ret:string[] = [];
        try {
            ret = this.computeFilterIds(fwId);
        } catch(e) {
        }
        this.currentStatus.dynStateByDevices[fwId].filterIds = ret;
    }

    updateFilterIdsForSomeFilterWheels=(wildcards:TriggeredWildcard)=> {
        const idList = wildcards[NoWildcard]
            ? Object.keys(this.currentStatus.dynStateByDevices)
            : Object.keys(wildcards);
            
        for(const id of idList) {
            this.updateFilterIds(id);
        }

    }

    setFilterWheel=async (ct: CancellationToken, payload:{cameraDeviceId:string, filterWheelDeviceId: string|null})=>{
        const camStatus = this.context.camera.currentStatus;
        if (!hasKey(camStatus.dynStateByDevices, payload.cameraDeviceId)) {
            throw new Error("Invalid camera");
        }
        if ((payload.filterWheelDeviceId !== null) && this.currentStatus.availableDevices.indexOf(payload.filterWheelDeviceId) === -1) {
            throw new Error("Invalid filterwheel");
        }
        camStatus.dynStateByDevices[payload.cameraDeviceId].filterWheelDevice = payload.filterWheelDeviceId;
        camStatus.configuration.deviceSettings[payload.cameraDeviceId].preferedFilterWheelDevice = payload.filterWheelDeviceId;
    }

    abortFilterChange= async(ct:CancellationToken, payload:any)=>{}

    // FIXME: only if required
    changeFilter= async(ct:CancellationToken, payload: {cameraDeviceId?: string, filterWheelDeviceId?: string, filterNumber?: number, filterId?: string, force?: boolean})=>{
        let filterWheelDeviceId;
        if (payload.filterWheelDeviceId === undefined) {
            if (payload.cameraDeviceId === undefined) {
                throw new Error("Camera or filterWheel required");
            }
            const camStatus = this.context.camera.currentStatus;
            if (!hasKey(camStatus.dynStateByDevices, payload.cameraDeviceId)) {
                throw new Error("Invalid camera");
            }
            const camDynState = camStatus.dynStateByDevices[payload.cameraDeviceId];
            if (!camDynState.filterWheelDevice) {
                throw new Error("Camera has no filterwheel");
            }
            filterWheelDeviceId = camDynState.filterWheelDevice;
        } else {
            filterWheelDeviceId = payload.filterWheelDeviceId;
        }

        if (!hasKey(this.currentStatus.dynStateByDevices, filterWheelDeviceId)) {
            throw new Error("Device not available");
        }
        let filterPos:number;
        if (payload.filterId !== undefined) {
            let i = this.currentStatus.dynStateByDevices[filterWheelDeviceId].filterIds.indexOf(payload.filterId);
            if (i === -1) {
                throw new Error("Unknown filter");
            }
            filterPos = i + 1;
        } else if (payload.filterNumber !== undefined) {
            // FIXME: check bounds but indi SHOULD explicitely reject invalid values
            filterPos = payload.filterNumber!;
        } else {
            throw new Error("No filter provided");
        }

        if (this.currentStatus.dynStateByDevices[filterWheelDeviceId].targetFilterPos !== null) {
            throw new Error("Filter wheel busy");
        }
        if ((!payload.force)
            && this.currentStatus.dynStateByDevices[filterWheelDeviceId].currentFilterPos === filterPos)
        {
            console.log('FilterWheel already at pos', filterWheelDeviceId, filterPos);
            return false;
        }

        try {
            // record target pos in dynState
            this.currentStatus.dynStateByDevices[filterWheelDeviceId].targetFilterPos = filterPos;
            console.log('Moving FilterWheel at pos', filterWheelDeviceId, filterPos);
            await this.indiManager.setParam(ct,
                filterWheelDeviceId,
                'FILTER_SLOT',
                {'FILTER_SLOT_VALUE': "" + filterPos},
                true,
                false
                // FIXME: cancelator
            );

        } finally {
            this.currentStatus.dynStateByDevices[filterWheelDeviceId].targetFilterPos = null;
        }
        return true;
    }

    getAPI() {
        return {
            setFilterWheel:this.setFilterWheel,
            abortFilterChange: this.abortFilterChange,
            changeFilter: this.changeFilter,
        }
    }
}