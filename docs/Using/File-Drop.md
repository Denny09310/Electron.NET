# File Drop (drag & drop into windows)

Electron no longer exposes the filesystem path of a dropped file through the `File`
object (`File.path` was removed in Electron 32). The path must be resolved with
[`webUtils.getPathForFile`](https://www.electronjs.org/docs/latest/api/web-utils),
which can only be called from a preload script — even more so with context isolation
turned on ([#1002](https://github.com/ElectronNET/Electron.NET/issues/1002)).

Electron.NET ships this for you, so app-side **code and configuration are not
required**: every framework-created `BrowserWindow` and `BrowserView` runs a small
framework preload that resolves the path with `webUtils.getPathForFile` and exposes it
safely to the page.

## Usage in the page

Inside your page JavaScript (Blazor / ASP.NET / WASM doesn't matter - this runs in the
window the framework created), handle the DOM `drop` event and resolve the path there:

```js
const path = window.electronNET?.getPathForFile(dataTransfer.files[0]);
```

A complete handler:

```html
<div id="drop-zone"
     ondragover="return onDragOver(event)"
     ondrop="return onDrop(event)"></div>

<script>
    function onDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        return false;
    }

    function onDrop(event) {
        event.preventDefault();

        const files = Array.from(event.dataTransfer.files).map((file) => ({
            name: file.name,
            type: file.type,
            size: file.size,
            // Filesystem path; '' when the object has no backing file on disk
            path: window.electronNET?.getPathForFile(file) ?? "",
        }));

        console.log(files);
        return false;
    }
</script>
```

> [!NOTE]
> Because the exposed method is callable by any script in your page, keep the same
> rules you would apply to `File.path`: only trust paths of files the user actually
> dropped, and don't forward paths from untrusted remote content into privileged APIs.

## Custom preload logic in hardened windows

Apps that harden their windows (`WebPreferences.ContextIsolation = true` or
`WebPreferences.Sandbox = true`) and need more than file paths can supply their own
preload script via the existing `WebPreferences.Preload` property (absolute path to a
script file). Copy the script into your app's output with a `csproj` entry like the
one for `custom_main.js` — the packaged build carries it with the app, and Electron
resolves the path inside the packaged artifact as well:

```xml
<None Update="electron\my-preload.js">
    <CopyToOutputDirectory>PreserveNewest</CopyToOutputDirectory>
</None>
```
