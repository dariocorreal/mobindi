import React, { Component, PureComponent} from 'react';
import BaseApp from '../BaseApp';
import * as Promises from '../shared/Promises';

export type Props = {
    src: string|null;
    app: BaseApp;
};

export type State = {
    src: string|null;
    value: string|null;
    loading: boolean;
};

export default class FWHMDisplayer extends PureComponent<Props, State> {
    private request? : Promises.Cancelable<void, any>;
    constructor(props:Props) {
        super(props);
        this.state = {
            src: null,
            value: null,
            loading: false
        }
    }

    _loadData() {
        if (this.props.src === this.state.src) {
            return;
        }
        // Start a new loading.
        // cancel the previous request
        this._cancelLoadData();
        this.setState({
            src: this.props.src,
            value: null,
            loading: true
        });
        const self = this;

        this.request = this.props.app.appServerRequest('imageProcessor', {
                method: 'compute',
                details: {"starField":{ "source": { "path":this.props.src}}}
        }).then((e)=>{
            let fwhmSum = 0;
            for(let star of e.stars) {
                fwhmSum += star.fwhm
            }
            if (e.stars.length) {
                fwhmSum /= e.stars.length;
            }

            const stat = fwhmSum.toFixed(2) + " - " + e.stars.length + " stars"

            this.setState({
                value: stat,
                loading: false
            });
        }).onError((e)=> {
            this.setState({
                value: null,
                loading: false
            });
        });
        this.request.start(undefined);
    }

    _cancelLoadData() {
        if (this.request !== undefined) {
            this.request.cancel();
            this.request = undefined;
        }
    }

    componentWillUnmount() {
        this._cancelLoadData();
    }

    componentDidMount() {
        this._loadData();
    }

    componentDidUpdate(prevProps:Props, prevState:State) {
        this._loadData();
    }

    render() {
        if (this.state.value === null) {
            if (this.state.loading) {
                return <div>...</div>;
            } else {
                return <div>N/A</div>;
            }
        } else {
            return <div>{this.state.value}</div>
        }
    }
}
