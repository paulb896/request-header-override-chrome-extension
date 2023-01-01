<img src="src/assets/img/main-icon-128.png" width="128"/>

# HTTP Request Header Overrides Chrome Extension

[Chrome Extension Webpage](https://chrome.google.com/webstore/detail/request-header-override-m/cfgjehpalgepkcfekgjgmklehchiidgi?hl=en).

The extension allows the user to manage request headers that will be injected into requests made when viewing a website in chrome, where each header contains the following properties:

* Header Name: Header key.
* Header Value: Value associated with the header key.
* AJAX Request URL sub-string: The header name: value will only be applied to XHR/Fetch requests where the external request URL contains the provided substring.

The headers are managed in the chrome extension popup (a simple react app), and saved to chrome local storage and are applied to upstream page requests using the chrome declarativeNetRequest request dynamic rules updateDynamicRules function.

## Local Development

### Start Local Server

1. Run `npm install` to install the dependencies.
1. Run `npm start`
1. Load your extension on Chrome following:
   1. Access `chrome://extensions/`
   1. Check `Developer mode`
   1. Click on `Load unpacked extension`
   1. Select the `build` folder.

## Packing

After the development of your extension run the command

```
$ NODE_ENV=production npm run build
```

Now, the content of `build` folder will be the extension ready to be submitted to the Chrome Web Store. Just take a look at the [official guide](https://developer.chrome.com/webstore/publish) to more infos about publishing.

## Resources:

|  Source  |      Description      |
|----------|-----------------------|
| [chrome-extension-boilerplate-react](https://github.com/lxieyang/chrome-extension-boilerplate-react) | A React Chrome Extension Boilerplate template used for the http request header override extension project |
| [Chrome Extension documentation](https://developer.chrome.com/extensions/getstarted) | Main Google Docs for developing Chrome Extensions |
| [Mozilla Todo React App Example](https://developer.mozilla.org/en-US/docs/Learn/Tools_and_testing/Client-side_JavaScript_frameworks/React_todo_list_beginning) | Used as a basis for the [request header react app](src/pages/Popup/components/RequestHeadersApp.jsx) |

---

Paul Beauchamp | [Website](https://github.com/paulb896)
