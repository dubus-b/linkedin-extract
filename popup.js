document.getElementById("extractBtn").addEventListener("click", async () => {
    console.log("🟢 Demande d'extraction envoyée...");

    let [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    chrome.scripting.executeScript(
        {
            target: { tabId: tab.id },
            function: getLinkedInProfileData
        },
        (result) => {
            if (result && result[0] && result[0].result) {
                let { firstName, lastName, job, companie, csv } = result[0].result;
                // Affichage dans la popup
                document.getElementById("csvOutput").innerText = csv;
            } else {
                console.log("❌ Aucune donnée extraite.");
                // document.getElementById("csvOutput").innerText = "Erreur d'extraction";
            }
        }
    );
});


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
            let job =  "Non spécifié"
            let companie =  "Non spécifié" 
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
                csv = `${firstName},${lastName},${job},${companie},${document.URL}`
                console.log(csv)

            } else {
                console.log("❌ Aucune section ", keyword, "trouvée.");
            }
            return { firstName, lastName, job, companie, csv };


        } catch (error) {
            console.error("Erreur d'extraction :", error);
        }
    })();
}
