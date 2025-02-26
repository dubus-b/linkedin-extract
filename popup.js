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

    chrome.storage.onChanged.addListener(function (changes, areaName) {
        if (areaName === "local" && changes.contacts) {
            document.getElementById("parsed").innerText = changes.contacts.newValue.length || "Aucune donnée";
        }
    });

    chrome.storage.onChanged.addListener(function (changes, areaName) {
        if (areaName === "local" && changes.totalContact) {
            document.getElementById("total").innerText = changes.totalContact.newValue || 0;
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


let extractBtn = document.getElementById("extractContactBtn");
if (extractBtn) {
    extractBtn.addEventListener("click", async () => {
        let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.storage.local.set({ contacts: [] })
        chrome.scripting.executeScript(
            {
                target: { tabId: tab.id },
                function: getContact
            },
            (result) => {
                if (result) {
                    console.log("OK")
                } 
            }
        );
    });
} else {
    console.error("Le bouton extractBtn n'existe pas !");
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

            if (!fullNameElement) throw new Error("Impossible de récupérer le nom du profil");

            let fullName = fullNameElement.innerText.trim();
            let [firstName, ...lastName] = fullName.split(" ");
            let job = "Non spécifié"
            let companie = "Non spécifié"
            lastName = lastName.join(" ");

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
                console.log("Aucune section ", keyword, "trouvée.");
            }
            return { firstName, lastName, job, companie, csv };
        } catch (error) {
            console.error("Erreur d'extraction :", error);
        }
    })();
}

function getContact() {
    return (async () => {
        try {
            console.log("Changement de zoom en cours...");
            // Demander au background script de réduire le zoom à 25%
            await new Promise(resolve => 
                chrome.storage.local.set({ totalContact: Number(document.querySelectorAll('app-paginationx pagination-template span span')[2].outerText.replace(',', '')) }, resolve)
            );
            chrome.runtime.sendMessage({ action: "setZoom", zoom: 0.25}, (response) => {
                console.log("Zoom appliqué à 25%, démarrage de la recherche...");

                async function clickRows(index, rows, callback) {
                    if (index < rows.length) {
                        rows[index].click();
                        
                        setTimeout(async function () {
                            try {
                                let person = Object.assign({}, 
                                    parseTableRow(rows[index]), 
                                    parseContactInfo(document.querySelector('app-search-person-details-company-tab'))
                                );
                
                                // Récupération des contacts stockés
                                let storedResult = await new Promise(resolve => 
                                    chrome.storage.local.get(["contacts"], resolve)
                                );
                
                                let stored = storedResult.contacts || [];
                                stored.push(person); // Ajouter la nouvelle personne
                
                                // Sauvegarde des contacts mis à jour
                                await new Promise(resolve => 
                                    chrome.storage.local.set({ contacts: stored }, resolve)
                                );
                
                                console.log("Contact ajouté :", person);
                            } catch (error) {
                                console.error("Erreur lors du stockage des contacts :", error);
                            }
                        }, 1500); 
                
                        // Attendre avant de cliquer sur la prochaine ligne
                        setTimeout(() => clickRows(index + 1, rows, callback), 2000);
                    } else {
                        console.log("Toutes les lignes de cette page ont été cliquées !");
                        callback(); // Passer à la page suivante
                    }
                }

                function parseTableRow(row) {
                    const person = {};
                
                    // Récupérer le nom et le lien du profil
                    const nameAnchor = row.querySelector('td.ant-table-cell a.t-text-primary-600');
                    if (nameAnchor) {
                        person.name = nameAnchor.textContent.trim();
                        person.profileLink = nameAnchor.href;
                    }
                
                    // Récupérer le lien LinkedIn
                    const linkedInAnchor = row.querySelector('a[href*="linkedin.com"]');
                    if (linkedInAnchor) {
                        person.linkedin = linkedInAnchor.href;
                    }
                
                    // Récupérer le poste
                    const jobTitleDiv = row.querySelector('td:nth-child(3) > div');
                    if (jobTitleDiv) {
                        person.jobTitle = jobTitleDiv.textContent.trim();
                    }
                
                    // Récupérer le nom de l'entreprise et son lien
                    const companyAnchor = row.querySelector('td:nth-child(5) a.t-text-primary-600');
                    if (companyAnchor) {
                        person.company = companyAnchor.textContent.trim();
                        person.companyLink = companyAnchor.href;
                    }
                
                    // Récupérer le secteur d'activité
                    const industryDiv = row.querySelector('td:nth-child(6) > div');
                    if (industryDiv) {
                        person.industry = industryDiv.textContent.trim();
                    }
                    return person;
                }

                function parseContactInfo(companyTabElement) {
                    if (!companyTabElement) return null;
                
                    let contactInfo = {
                        phones: [],
                        email: null
                    };
                
                    // Récupérer les numéros de téléphone
                    companyTabElement.querySelectorAll('a[href^="tel:"]').forEach(phoneLink => {
                        contactInfo.phones.push(phoneLink.textContent.trim());
                    });
                
                    // Récupérer l'email
                    let emailElement = companyTabElement.querySelector('a[href^="mailto:"]');
                    if (emailElement) {
                        contactInfo.email = emailElement.textContent.trim();
                    }
                    return contactInfo;
                }
                

                // Fonction pour aller à la page suivante
                function goToNextPage(callback) {
                    let nextButton = document.querySelector('.pagination-next a');
                    
                    if (nextButton) {
                        console.log("Passage à la page suivante...");
                        nextButton.click(); // Simuler un clic sur le bouton "Next"
                        setTimeout(callback, 2000); // Attendre 2 secondes pour charger la nouvelle page
                    } else {
                        console.warn("Aucun bouton 'Next' trouvé, fin de la pagination.");

                        // Une fois toutes les pages traitées, remettre le zoom à 100%
                        chrome.runtime.sendMessage({ action: "setZoom", zoom: 1.0 }, (response) => {
                            if (response && response.success) {
                                console.log("Zoom rétabli à 100%");
                            } else {
                                console.error("Échec de la remise du zoom à 100%");
                            }
                        });
                    }
                }

                // Fonction principale pour traiter toutes les pages
                function processPages() {
                    const rows = document.querySelectorAll("tr.ant-table-row.ng-star-inserted");

                    if (rows.length > 0) {
                        clickRows(1, rows, () => {
                            goToNextPage(processPages); // Recommencer pour la page suivante
                        });
                    } else {
                        console.log("Aucune ligne trouvée sur cette page.");
                        goToNextPage(processPages);
                    }
                }
                // 🚀 Démarrer le traitement des pages
                processPages();
            });
        } catch (error) {
            console.log("Erreur :", error);
        }
    })();
}


function exportToCSV(filename = "export.csv") {
    if (!dataArray || !dataArray.length) {
        console.error("Aucune donnée à exporter.");
        return;
    }

    // Trouver le nombre maximal de numéros de téléphone dans une entrée
    const maxPhones = Math.max(...dataArray.map(obj => obj.phones ? obj.phones.length : 0));

    // Définition des colonnes du CSV
    let headers = [
        "Name", "Profile Link", "LinkedIn", "Job Title", 
        "Company", "Company Link", "Industry", "Email"
    ];

    // Ajouter les colonnes dynamiques pour les téléphones
    for (let i = 1; i <= maxPhones; i++) {
        headers.push(`Phone ${i}`);
    }

    // Création des lignes CSV
    const csvRows = [];
    
    // Ajouter l'en-tête
    csvRows.push(headers.join(";")); // Utilisation de ";" comme séparateur (modifiable)

    // Remplir le CSV avec les données
    dataArray.forEach(obj => {
        const row = [
            obj.name || "",
            obj.profileLink || "",
            obj.linkedin || "",
            obj.jobTitle || "",
            obj.company || "",
            obj.companyLink || "",
            obj.industry || "",
            obj.email || ""
        ];

        // Ajouter les téléphones en colonnes distinctes
        if (obj.phones) {
            for (let i = 0; i < maxPhones; i++) {
                row.push(obj.phones[i] || ""); // Si pas de numéro, cellule vide
            }
        }

        csvRows.push(row.join(";"));
    });

    // Création du fichier Blob en CSV
    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    // Création du lien de téléchargement
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    // Nettoyage du DOM
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}