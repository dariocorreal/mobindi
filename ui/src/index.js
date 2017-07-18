import React from 'react';
import ReactDOM from 'react-dom';
import { connect } from 'react-redux';
import { Provider } from 'react-redux'
import './index.css';
import Screen from './Screen';
import App from './App';
import registerServiceWorker from './registerServiceWorker';
import { store } from './Store';


ReactDOM.render(
        <Provider store={store}>
            <Screen>
                <App>
                    <p>On est connecté!</p>
                </App>
            </Screen>
        </Provider>, document.getElementById('root'));
registerServiceWorker();
