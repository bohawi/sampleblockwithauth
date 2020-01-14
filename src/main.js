require('../node_modules/@salesforce-ux/design-system/assets/styles/salesforce-lightning-design-system.css');
require('./main.css');

const SDK = require('blocksdk');
const sdk = new SDK();
const state = {
	imageID: undefined
};
const allImages = {};

function post (url, data, cb) {
	fetch('/proxy/' + url, {
		method: 'POST',
		body: JSON.stringify(data),
		headers: self.headers,
		credentials: 'include',
		mode: 'no-cors'
	}).then(function (res) {
		if (res.status === 401) {
			return Promise.reject('401');
		}

		return res.json();
	}).then(function (data) {
		cb(data);
	});
};

function updateSelected () {
	const { imageID } = state;
	for (let key in allImages) {
		if (parseInt(key, 10) === parseInt(imageID, 10)) {
			allImages[key].classList.add('selected');
		} else {
			allImages[key].classList.remove('selected');
		}
	}
}

post('asset/v1/content/assets/query', {
	query: {
		property: 'assetType.id',
		simpleOperator: 'in',
		value: [20, 22, 23, 28]
	}
}, function (data) {
	const items = data && data.items || [];
	const workspace = document.getElementById('workspace');

	items.forEach(thisItem => {
		const { fileProperties, id } = thisItem;
		const { publishedURL } = fileProperties;

		const img = document.createElement('img');
		img.src=publishedURL;
		img.addEventListener('click', () => {
			sdk.setContent(`<img src="${publishedURL}" width="100%"></img>`);
			state.imageID = id;
			sdk.setData({
				imageID: id
			});

			updateSelected();
		});
		
		allImages[id] = img;
		workspace.appendChild(img);
	});

	sdk.getData((data) => {
		state.imageID = data.imageID;

		updateSelected();
	});
	
	// for (var key in data.items) {
	// 	var src = data.items[key].fileProperties.publishedURL;
	// 	dom += '<div style="display:inline-block;width:50px;border:1px solid white;height:50px"><img style="width:50px;height:50px;background-color:lightgray;" onclick="setContent(\'' + src + '\')" src="' + src + '"></img></div>';
	// }
	// document.getElementById('workspace').innerHTML = dom;
});
