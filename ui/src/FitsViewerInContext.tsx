import * as React from "react";

import * as Actions from "./Actions";
import * as Store from "./Store";
import * as FitsViewerStore from "./FitsViewerStore";
import FitsViewer, {Props as FitsViewerProps, FullState as FitsViewerFullState} from './FitsViewer/FitsViewer';

export type InputProps = {
    path: FitsViewerProps["path"];
    streamId: FitsViewerProps["streamId"];
    streamSerial: FitsViewerProps["streamSerial"];
    streamSize: FitsViewerProps["streamSize"];
    subframe: FitsViewerProps["subframe"];
    contextKey: string;
    contextMenu : FitsViewerProps["contextMenu"];
};

type MappedProps = {
    viewSettings: FitsViewerProps["viewSettings"];
};

type Props = InputProps & MappedProps;

export class UnmappedFitsViewerInContext extends React.PureComponent<Props> {
    fitsViewer = React.createRef<FitsViewer>();
    constructor(props:Props) {
        super(props);
    }

    saveViewSettings=(e:FitsViewerFullState)=>{
        Actions.dispatch<FitsViewerStore.Actions>()("setViewerState", {
            context: this.props.contextKey,
            viewSettings: e
        });
    }

    render() {
        return <FitsViewer ref={this.fitsViewer}
                            path={this.props.path}
                            streamId={this.props.streamId}
                            streamSize={this.props.streamSize}
                            streamSerial={this.props.streamSerial}
                            subframe={this.props.subframe}
                            viewSettings={this.props.viewSettings}
                            onViewSettingsChange={this.saveViewSettings}
                            contextMenu={this.props.contextMenu}/>
    }

    static mapStateToProps(store: Store.Content, ownProps: InputProps) {
        return {
            viewSettings: FitsViewerStore.getViewerState(store, ownProps.contextKey)
        };
    }
}

export default Store.Connect<UnmappedFitsViewerInContext, InputProps, {}, MappedProps>(UnmappedFitsViewerInContext);
