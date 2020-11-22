import * as React from 'react';
import * as Store from './Store';
import { noErr } from './Utils';
import * as BackendRequest from "./BackendRequest";
import * as DeviceIdMapper from './indiview/DeviceIdMapper';
import * as FilterWheelStore from "./FilterWheelStore";
import CancellationToken from 'cancellationtoken';

import './CameraView.css'
import DeviceConnectBton from './DeviceConnectBton';

type InputProps = {
    filterWheelDevice: string;

    // Where to store the choosen filter
    getFilter(store: Store.Content, filterWheelDeviceId: string): string | null;
    isBusy?:(store:Store.Content, filterWheelDeviceId: string)=>boolean;
    setFilter: (filterWheelDeviceId: string|null, filterId: string|null) => Promise<void>;

    focusRef?: React.RefObject<HTMLSelectElement>
}

type MappedProps = {
    currentFilter: string | null;
    availableFilters: string[];
    busy: boolean;
}

type Props = InputProps & MappedProps;


class FilterSelector extends React.PureComponent<Props> {
    constructor(props: Props) {
        super(props);
    }

    forceOption(valid: string[], possiblyMissing: string | null) {
        let ret = valid.map(v => ({ title: v, value: v }));

        if (possiblyMissing !== null && valid.indexOf(possiblyMissing) === -1) {
            ret = [
                {
                    title: possiblyMissing + '-Missing',
                    value: possiblyMissing,
                },
                ...ret
            ];
        }
        return ret;
    }

    currentFilters() {
        const filters = this.forceOption(this.props.availableFilters, this.props.currentFilter);
        if (filters.length === 0) {
            return <option key={"nofilter"} value="nofilter" disabled>No filter found</option>;

        }
        return filters.map((filter) =>
            <option key={"filter:" + filter.value} value={"filter:" + filter.value}>{filter.title}</option>
        );
    }

    update = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const targetValue = e.target.value;
        if (targetValue.startsWith("filter:")) {
            const targetFilter = targetValue.substr(7);
            this.props.setFilter(this.props.filterWheelDevice, targetFilter);
        } else {
            throw new Error("unsupported filterwheel value: " + targetValue);
        }
    }

    render() {
        const currentValue = this.props.currentFilter === null
            ? ""
            : "filter:" + this.props.currentFilter;
        return <>
            <span>
                <select className={"FilterSelector" + (this.props.busy ? " BusyInfinite" : "")} onChange={this.update} value={currentValue} ref={this.props.focusRef}>
                    { this.props.currentFilter === null
                            ? <option value="" disabled hidden>Filter...</option>
                            : null
                    }
                    {
                            this.currentFilters()
                    }

                </select>
            </span>
        </>
    }

    static mapStateToProps = function (store: Store.Content, ownProps: InputProps) {
        const currentFilterWheel = ownProps.filterWheelDevice;

        return ({
            currentFilterWheel,

            busy:
                currentFilterWheel === null || !ownProps.isBusy
                    ? false
                    : ownProps.isBusy(store, currentFilterWheel),
            currentFilter:
                currentFilterWheel === null
                    ? null
                    : ownProps.getFilter(store, currentFilterWheel),
            availableFilters:
                currentFilterWheel === null
                    ? null
                    : FilterWheelStore.availableFilterIds(store, currentFilterWheel),
        });
    }
}

export default Store.Connect(FilterSelector);




