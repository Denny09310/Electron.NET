using Microsoft.AspNetCore.Mvc;
using ElectronNET.API;

namespace ElectronNET.WebApp.Controllers
{
    public class FileDropController : Controller
    {
        public IActionResult Index()
        {
            if (HybridSupport.IsElectronActive)
            {
                Electron.IpcMain.On("open-dropped-folder", (path) =>
                {
                    Electron.Shell.ShowItemInFolderAsync(path.ToString());
                });
            }

            return View();
        }
    }
}
