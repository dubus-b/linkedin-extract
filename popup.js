document.addEventListener("DOMContentLoaded", function () {
    // Charger les données stockées au démarrage
    chrome.storage.local.get(["csv"], function (result) {
        if (result.csv) {
            document.getElementById("csvOutput").innerText = result.csv;
        }
    });

    // Écoute des changements dans le stockage
    chrome.storage.onChanged.addListener(function (changes, areaName) {
        if (areaName === "local" && changes.csv) {
            console.log("Changement détecté :", changes.csv);
            document.getElementById("csvOutput").innerText = changes.csv.newValue || "Aucune donnée";
        }
    });

    // Vérifier et ajouter un event listener au bouton "clear"
    let clearBtn = document.getElementById("clearBtn");
    if (clearBtn) {
        clearBtn.addEventListener("click", function () {
            console.log("Bouton cliqué !");
            chrome.storage.local.remove("csv", function () {
                console.log("Donnée supprimée !");
                document.getElementById("csvOutput").innerText = "";
            });
        });
    } else {
        console.error("Le bouton clearBtn n'existe pas !");
    }

    // Vérifier et ajouter un event listener au bouton "extract"
    let extractBtn = document.getElementById("extractBtn");
    if (extractBtn) {
        extractBtn.addEventListener("click", async () => {
            let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            chrome.scripting.executeScript(
                {
                    target: { tabId: tab.id },
                    function: getLinkedInProfileData
                },
                (result) => {
                    if (result && result[0] && result[0].result) {
                        let { firstName, lastName, job, companie, csv } = result[0].result;

                        // Récupérer d'abord les anciennes données
                        chrome.storage.local.get(["csv"], function (storedResult) {
                            let stored = storedResult.csv || ""; // Si pas de données, initialiser à ""

                            // Concaténer avec la nouvelle valeur
                            let newCsv = stored ? stored + "\n" + csv : csv;
                            console.log("Nouvelle donnée stockée :", newCsv);

                            // Sauvegarder dans chrome.storage
                            chrome.storage.local.set({ csv: newCsv }, function () {
                                console.log("Donnée enregistrée !");
                            });
                        });
                    } else {
                        document.getElementById("csvOutput").innerText = "Erreur d'extraction";
                    }
                }
            );
        });
    } else {
        console.error("Le bouton extractBtn n'existe pas !");
    }
});

// Vérifier et ajouter un event listener au bouton "Exporter en CSV"
let exportBtn = document.getElementById("exportBtn");
if (exportBtn) {
    exportBtn.addEventListener("click", function () {
        chrome.storage.local.get(["csv"], function (result) {
            if (!result.csv) {
                alert("Aucune donnée à exporter !");
                return;
            }
    
            // Ajouter le BOM pour forcer l'encodage UTF-8
            let bom = "\uFEFF";
            let csvContent = "data:text/csv;charset=utf-8," + bom + encodeURIComponent(result.csv);
    
            let link = document.createElement("a");
            link.setAttribute("href", csvContent);
            link.setAttribute("download", "extraction.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    });
} else {
    console.error("Le bouton exportBtn n'existe pas !");
}

// Fonction exécutée directement dans la page
function getLinkedInProfileData() {
    function waitForElement(selector, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            const check = () => {
                const element = document.querySelector(selector);
                if (element) {
                    resolve(element);
                } else if (Date.now() - startTime > timeout) {
                    reject(`Timeout : Impossible de trouver ${selector}`);
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    }

    return (async () => {
        try {
            let selectors = ['h1', '[data-test-id="hero-title"]', '.text-heading-xlarge'];
            let fullNameElement = null;

            for (let selector of selectors) {
                try {
                    fullNameElement = await waitForElement(selector);
                    break;
                } catch (err) {
                    console.warn(`⏳ Échec avec ${selector}, tentative suivante...`);
                }
            }

            if (!fullNameElement) throw new Error("❌ Impossible de récupérer le nom du profil");

            let fullName = fullNameElement.innerText.trim();
            let [firstName, ...lastName] = fullName.split(" ");
            let job = "Non spécifié"
            let companie = "Non spécifié"
            lastName = lastName.join(" ");

            function normalizeText(text) {
                return text.normalize("NFC").replace(/\s+/g, ' ').trim(); // Supprime espaces et normalise l'encodage
            }

            let keyword = "Expérience";

            let sections = document.querySelectorAll('section');
            let experienceSection = Array.from(sections).find(section => section.innerText.substring(0, 3) == "Exp")

            if (experienceSection) {
                let jobs = experienceSection.querySelectorAll('.t-bold'); // Sélecteur du poste
                let companies = experienceSection.querySelectorAll('.t-14.t-normal'); // Sélecteur entreprise

                if (jobs.length > 0) {
                    job = jobs[0]?.innerText.trim() || "Non spécifié"
                    job = job.split('\n')[0]
                    companie = companies[0]?.innerText || "Non spécifié"
                    companie = companie.split('\n')[0]
                }
                csv = `${firstName};${lastName};${job};${companie};${document.URL}`

            } else {
                console.log("❌ Aucune section ", keyword, "trouvée.");
            }
            return { firstName, lastName, job, companie, csv };
        } catch (error) {
            console.error("Erreur d'extraction :", error);
        }
    })();
}
