/**********************
 *
 *   Loading Helpers
 *
 **********************/

function ajax(url, callback) {
	var oReq = new XMLHttpRequest()
	oReq.open('GET', url, true)
	oReq.responseType = 'arraybuffer'

	oReq.onload = function(oEvent) {
		console.log('ajax done for ', url)
		var arrayBuffer = oReq.response
		callback(arrayBuffer)
	}

	oReq.send()
}

// TODO Drag and Drop, File Opener
var opener = document.getElementById('opener')
opener.onchange = function() {
	var files = opener.files
	handleFileList(files)
}

function handleFileList(files) {
	if (files && files.length) {
		console.log(files)
		// TODO filter file.name / name.type
		readFile(files[0])
	}
}

function readFile(file) {
	var reader = new FileReader()
	reader.onload = function(event) {
		var arraybuffer = event.target.result
		console.log(event)
		processData(arraybuffer)
	}
	reader.readAsArrayBuffer(file)
}

function setupDragAndDrop(element) {
	element.ondragover = function handleDragOver(evt) {
		evt.stopPropagation()
		evt.preventDefault()
		evt.dataTransfer.dropEffect = 'copy' // Explicitly show this is a copy.
	}

	element.ondrop = function handleFileSelect(evt) {
		evt.stopPropagation()
		evt.preventDefault()
		var files = evt.dataTransfer.files

		handleFileList(files)
	}
}

setupDragAndDrop(document.body)

export { ajax }
