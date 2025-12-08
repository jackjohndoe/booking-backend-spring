import React from 'react';
import { Platform } from 'react-native';

// For web platform, use an iframe
// For native platforms, use react-native-webview
let WebViewComponent;

if (Platform.OS === 'web') {
  // Web implementation using iframe
  WebViewComponent = ({ source, style, onLoadEnd, onError, ...props }) => {
    const handleLoad = () => {
      if (onLoadEnd) {
        onLoadEnd();
      }
    };

    const handleError = () => {
      if (onError) {
        onError();
      }
    };

    // Extract HTML from source
    const html = source?.html || '';
    const baseUrl = source?.baseUrl || '';

    // Create a data URI for the HTML content
    const dataUri = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;

    return (
      <iframe
        src={dataUri}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          ...style,
        }}
        onLoad={handleLoad}
        onError={handleError}
        {...props}
      />
    );
  };
} else {
  // Native implementation using react-native-webview
  const { WebView } = require('react-native-webview');
  
  WebViewComponent = ({ source, style, onLoadEnd, onError, ...props }) => {
    return (
      <WebView
        source={source}
        style={style}
        onLoadEnd={onLoadEnd}
        onError={onError}
        {...props}
      />
    );
  };
}

export default WebViewComponent;
