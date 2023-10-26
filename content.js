
let lastAddress = ""
let lastRecords = []
let allRecords = []

// const fetch = async () => ({
//     text: async () => "<html><body></body></html>"
// })


new MutationObserver((mutationsList, observer) => {
    for (const mutation of mutationsList) {
        // If the addedNodes property has one or more nodes
        if (mutation.addedNodes.length) {
            // Check the current URL
            if (window.location.href.includes("/maps/place/")) {
                const address = window.location.href.match(/maps\/place\/(.+?)\//)?.[1].replaceAll("+", " ") ?? ""

                if (!address || address === lastAddress) {
                    return
                }

                lookupAddress(address)
                lastAddress = address
            }
        }
    }
}).observe(document.body, {
    childList: true,
    attributes: true,
    subtree: true,
})


const buttonContainer = document.createElement("div")
buttonContainer.style.position = "fixed"
buttonContainer.style.top = "20px"
buttonContainer.style.right = "20px"
buttonContainer.style.zIndex = 9999
buttonContainer.style.display = "flex"
buttonContainer.style.flexDirection = "column"
buttonContainer.style.alignItems = "stretch"
buttonContainer.style.width = "160px"
buttonContainer.style.gap = "10px"

const addButton = document.createElement("button")
addButton.style.backgroundColor = "blue"
addButton.style.color = "white"
addButton.style.borderRadius = "5px"
addButton.style.padding = "10px"
addButton.style.cursor = "pointer"
addButton.innerText = "Add Address To Export"

addButton.addEventListener("click", () => {
    allRecords.push(...lastRecords)
    console.log(`Added ${lastRecords.length} records\nTotal records: ${allRecords.length}\n`, allRecords)
})

const exportButton = document.createElement("button")
exportButton.style.backgroundColor = "darkred"
exportButton.style.color = "white"
exportButton.style.borderRadius = "5px"
exportButton.style.padding = "10px"
exportButton.style.cursor = "pointer"
exportButton.innerText = "Export JSON"

exportButton.addEventListener("click", () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allRecords, null, 2))
    const downloadAnchorNode = document.createElement('a')
    downloadAnchorNode.setAttribute("href", dataStr)
    downloadAnchorNode.setAttribute("download", "data.json")
    document.body.appendChild(downloadAnchorNode) // required for firefox
    downloadAnchorNode.click()
    downloadAnchorNode.remove()
})

buttonContainer.appendChild(addButton)
buttonContainer.appendChild(exportButton)
document.body.appendChild(buttonContainer)


async function lookupAddress(address) {

    if (!address)
        return

    const [streetAddress, city, stateZip] = address.split(", ")

    if (!streetAddress || !city || !stateZip)
        return

    const params = new URLSearchParams({
        streetaddress: streetAddress,
        citystatezip: `${city}, ${stateZip}`,
    })

    const url = `https://www.truepeoplesearch.com/resultaddress?${params.toString()}`
    console.log(`Looking up address:\n${address}\n${url}`)

    const pageContent = await fetch(url).then(res => res.text())
    const doc = new DOMParser().parseFromString(pageContent, "text/html")

    const allCards = [...doc.querySelectorAll(".card-summary")]
    const relevantCards = allCards.filter(el => findProperty(el, "lives in")?.split(", ")[0] === city)

    if (relevantCards.length === 0) {
        if (!allCards[0])
            return

        relevantCards.push(allCards[0])

        if (!allCards[1])
            return

        if (getName(allCards[0]).lastName == getName(allCards[1]).lastName) {
            relevantCards.push(allCards[1])
        }
    }

    const records = await Promise.all(
        relevantCards.map(async card => {

            const { firstName, middleInitial, lastName } = getName(card)
            const otherInfo = await lookupPerson(card)

            return {
                firstName,
                middleInitial,
                lastName,
                age: parseInt(findProperty(card, "age")),
                listedLocation: findProperty(card, "lives in"),
                streetAddress,
                city,
                state: stateZip.split(" ")[0],
                zip: stateZip.split(" ")[1],
                ...otherInfo,
            }
        })
    )

    console.log("Found", records.length, "records\n", records)
    lastRecords = records
}


/**
 * @param {Element} element
 */
function getName(element) {
    const [, firstName, middleInitial, lastName] = element.querySelector(".h4")?.textContent.trim().match(/(\w+) (?:(\w) )?(\w+)/) ?? []
    return {
        firstName,
        middleInitial,
        lastName,
    }
}


/**
 * @param {Element} element
 * @param {string} prop
 */
function findProperty(element, prop) {
    return [...element.querySelectorAll(".content-label")]
        .find(el => new RegExp(prop, "i").test(el.textContent))
        ?.parentNode?.querySelector(".content-value")?.textContent.trim()
}



/**
 * @param {Element} element
 */
async function lookupPerson(element) {
    const url = `https://www.truepeoplesearch.com${element.getAttribute("data-detail-link")}`

    const pageContent = await fetch(url).then(res => res.text())
    const doc = new DOMParser().parseFromString(pageContent, "text/html")

    const phoneContainer = findText(doc.body, "Possible Primary Phone")?.parentNode?.parentNode?.parentNode
    const phoneNumber = phoneContainer?.querySelector("a")?.textContent.replaceAll(/[\s()-]/g, "")
    const phoneType = phoneContainer?.querySelector(".smaller")?.textContent

    const emailContainer = findText(doc.body, "Email Addresses")?.parentNode?.parentNode?.parentNode
    const emailAddresses = [...(emailContainer?.children ?? [])].filter(el => el.textContent.includes("@")).map(el => el.textContent.trim())

    return {
        phoneNumber,
        phoneType,
        emailAddresses,
    }
}


/**
 * @param {Element} element
 * @param {string} text
 */
function findText(element, text) {
    if (!element.textContent.includes(text))
        return

    const foundChild = [...element.children].find(el => el.textContent.includes(text))

    if (!foundChild)
        return element

    return findText(foundChild, text)
}


function myFunction() {
    alert("Function executed!")
}

