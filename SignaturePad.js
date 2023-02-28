function SignaturePad(options) {
	options = options === undefined ? {} : options;

	this.canvasEl = options.canvas || document.createElement('canvas');
	this.context = this.canvasEl.getContext('2d');
	this.signatureBackground = document.createElement('div');
	this.curves = [];
	this.currentCurve = null;
	this.dialogActive = 0;

	this.isPointerDown = false;
	this.startTime = null;

	this.splashText = options.splashText !== undefined ? options.splashText : 'Click to start';

	// Settings

	this.brushSize = options.brushSize !== undefined ? options.brushSize : 5;
	this.brushColor = options.brushColor !== undefined ? options.brushColor : '#000';
	this.bgColor = options.bgColor !== undefined ? options.bgColor : '#fff';

	this.textFillColor = options.textFillColor !== undefined ? options.textFillColor : '#fff';
	this.textStrokeColor = options.textStrokeColor !== undefined ? options.textStrokeColor : '#000';
	this.textStrokeSize = options.textStrokeSize !== undefined ? options.textStrokeSize : 7;
	this.textFont = options.textFont !== undefined ? options.textFont : 'normal 40px monospace';

	this.pointBlackPercent = options.pointBlackPercent !== undefined ? options.pointBlackPercent : 0.005;
	this.canvasWhitePercent = options.canvasWhitePercent !== undefined ? options.canvasWhitePercent : 0.85;

	var dialog = options.dialog;

	if (dialog !== undefined) {
		this.sendDialogOnIncorrectSing = dialog.displayDialog !== undefined ? dialog.displayDialog : 'Y';
		this.dialogBodyText = dialog.bodyText !== undefined ? dialog.bodyText : "¡Ups! se ha detectado que la firma puede no ser correcta, por favor a continuación confirma si la firma mostrada en la parte superior parece ser correcta:";
		this.dialogBtnConfirm = dialog.btnConfirm !== undefined ? dialog.btnConfirm : "Confirmar y enviar firma";
		this.dialogBtnDecline = dialog.btnDecline !== undefined ? dialog.btnDecline : "Declinar y repetir firma";

		this.fncOnConfirm = dialog.btnConfirmFunction;
		this.fncOnDecline= dialog.btnDeclineFunction;
	}

	// Experimental for testing 

	this._smoothingEnabled = true;

	Object.defineProperty(this, 'smoothingEnabled', {

		set: function (value) {

			this._smoothingEnabled = value;
			this.draw();

		}

	});

	this.bindEventListeners();
	this.draw();

}

Object.assign(SignaturePad.prototype, {

	bindEventListeners: function () {

		this.canvasEl.addEventListener('mousedown', this.onMouseDown.bind(this), false);
		this.canvasEl.addEventListener('mousemove', this.onMouseMove.bind(this), false);
		window.addEventListener('mouseup', this.onMouseUp.bind(this), false);

		this.canvasEl.addEventListener('touchstart', this.onTouchStart.bind(this), false);
		this.canvasEl.addEventListener('touchmove', this.onTouchMove.bind(this), false);
		window.addEventListener('touchend', this.onTouchEnd.bind(this), false);

	},

	onMouseDown: function (event) {

		var box = this.canvasEl.getBoundingClientRect();
		this.onPointerDown(event.clientX - box.left, event.clientY - box.top);

	},

	onMouseMove: function (event) {

		var box = this.canvasEl.getBoundingClientRect();
		this.onPointerMove(event.clientX - box.left, event.clientY - box.top);

	},

	onMouseUp: function () {

		this.onPointerUp();

	},

	onTouchStart: function (event) {

		event.preventDefault();

		var box = this.canvasEl.getBoundingClientRect();
		this.onPointerDown(event.touches[0].clientX - box.left, event.touches[0].clientY - box.top);

	},

	onTouchMove: function (event) {

		event.preventDefault();

		var box = this.canvasEl.getBoundingClientRect();
		this.onPointerMove(event.touches[0].clientX - box.left, event.touches[0].clientY - box.top);

	},

	onTouchEnd: function (event) {

		this.onPointerUp();

	},

	onPointerDown: function (x, y) {

		this.isPointerDown = true;

		this.currentCurve = [];

		var time = Date.now();

		if (this.curves.length === 0) {

			this.startTime = time;

		}

		this.curves.push(this.currentCurve);

		this.currentCurve.push({
			x: x,
			y: y,
			time: time
		});

		this.draw();

	},

	onPointerMove: function (x, y) {

		if (this.isPointerDown) {

			var time = Date.now();
			this.currentCurve.push({
				x: x,
				y: y,
				time: time
			});
			this.draw();

		}

	},

	onPointerUp: function () {

		this.isPointerDown = false;
		this.currentCurve = null;
		this.draw();

	},

	clear: function () {

		this.curves.length = 0;
		this.currentCurve = null;
		this.draw()

	},

	setSize: function (width, height) {

		this.canvasEl.width = width;
		this.canvasEl.height = height;
		this.draw();

	},

	getData: function (getDurations, inSeconds) {

		var xValues = [];
		var yValues = [];
		var timeValues = [];

		var prevPoint = null;

		for (var i = 0; i < this.curves.length; i++) {

			var points = this.curves[i];

			for (var j = 0; j < points.length; j++) {

				xValues.push(points[j].x);
				yValues.push(points[j].y);

				if (getDurations) {

					if (prevPoint) {

						var time = points[j].time - prevPoint.time;

						if (inSeconds) {

							time /= 1000;

						}

						timeValues.push(time);

					} else {

						timeValues.push(0);

					}

					prevPoint = points[j];

				} else {

					var time = points[j].time - this.startTime;

					if (inSeconds) {

						time /= 1000;

					}

					timeValues.push(time);

				}

			}

		}

		if (xValues.length > 0) {
			var verify = this.verify();
			var dataStatus = {};
			dataStatus.status = verify.status;

			if (navigator.userAgent !== undefined && verify.status === 'Rejected') {
				dataStatus.userAgent = navigator.userAgent;
			}
		}

		var data = {
			xValues: xValues,
			yValues: yValues,
			timeValues: timeValues
		};

		if (dataStatus !== undefined) {
			Object.assign(data, dataStatus);
		}

		return data;
	},

	getDataInJSON: function (getDurations, inSeconds) {

		return JSON.stringify(this.getData(getDurations, inSeconds));

	},

	toDataURL: function () {

		return this.canvasEl.toDataURL.apply(this.canvasEl, arguments);

	},

	isBlank: function () {

		return this.curves.length === 0;

	},

	draw: function () {

		this.context.clearRect(0, 0, this.canvasEl.width, this.canvasEl.height);

		this.context.fillStyle = this.bgColor;
		this.context.fillRect(0, 0, this.canvasEl.width, this.canvasEl.height);

		this.context.strokeStyle = this.context.fillStyle = this.brushColor;
		this.context.lineWidth = this.brushSize;
		this.context.lineJoin = 'round';
		this.context.lineCap = 'round';

		for (var i = 0; i < this.curves.length; i++) {

			var points = this.curves[i];

			if (points.length === 0) continue;

			if (points.length === 1) {

				this.context.beginPath();
				this.context.arc(points[0].x, points[0].y, this.brushSize / 2, 0, Math.PI * 2);
				this.context.closePath();
				this.context.fill();

				continue;

			}

			this.context.beginPath();

			this.context.moveTo(points[0].x, points[0].y);

			if (this._smoothingEnabled) {

				for (var j = 1; j < points.length - 1; j++) {

					var mx = (points[j].x + points[j + 1].x) / 2;
					var my = (points[j].y + points[j + 1].y) / 2;
					this.context.quadraticCurveTo(points[j].x, points[j].y, mx, my);

				}

				this.context.lineTo(points[j].x, points[j].y)

			} else {

				for (var j = 1; j < points.length; j++) {

					this.context.lineTo(points[j].x, points[j].y);

				}

			}

			this.context.stroke();
			this.context.closePath();

		}

		if (this.curves.length === 0) {

			console.log('are we here');

			this.context.fillStyle = this.textFillColor;
			this.context.strokeStyle = this.textStrokeColor;

			this.context.font = this.textFont;
			this.context.textBaseline = 'middle';
			this.context.textAlign = 'center';
			this.context.lineWidth = this.textStrokeSize;
			this.context.strokeText(this.splashText, this.canvasEl.width / 2, this.canvasEl.height / 2);
			this.context.fillText(this.splashText, this.canvasEl.width / 2, this.canvasEl.height / 2);

		}

	},

	verify: function () {
		var imageData = this.context.getImageData(0, 0, this.canvasEl.width, this.canvasEl.height),
			pixels = imageData.data,
			numPixels = imageData.width * imageData.height,
			blackColor = 0, whiteColor = 0,
			whitePercent = 1 - this.pointBlackPercent;

		var blackMin = this.pointBlackPercent * numPixels;
		var whiteMin = whitePercent * numPixels;

		for (var i = 0; i < numPixels; i++) {

			var r = pixels[i * 4];
			var g = pixels[i * 4 + 1];
			var b = pixels[i * 4 + 2];


			var grayscale = 0.2126 * r + 0.7152 * g + 0.0722 * b;

			if (grayscale < 129) {
				blackColor++;
			} else if (grayscale > 128) {
				whiteColor++;
			}
		}

		var total = blackColor + whiteColor;
		var canvasArea = numPixels * whitePercent;

		var diff1 = blackColor - blackMin;
		var diff2 = canvasArea - whiteColor;

		if (blackColor > blackMin && whiteColor > (this.canvasWhitePercent * whiteMin) && total === numPixels && diff1 === diff2) {
			return JSON.parse("{\"status\":\"Approved\"}");
		} else {

			if (this.sendDialogOnIncorrectSing === 'Y') {
				this.sendDialog();
			}

			return JSON.parse("{\"status\":\"Rejected\"}");
		}

	},

	sendDialog: function () {
		var existDialog = document.getElementsByClassName('signature_background');

		if (existDialog.length === 0) {
			var background = this.signatureBackground;
			background.className = 'signature_background';
			background.style = 'position: fixed;display: table;width: 100%;height: 100%;top: 0;background: #a9a9a9b8;';
			var dialog = document.createElement('div');
			dialog.className = 'signature_square_container';
			dialog.style = 'width: 500px;flex-direction: column;align-items: center;background-color: rgb(255, 255, 255);color: rgb(0, 0, 0);text-align: center;border-radius: 10px;padding: 30px 30px 50px;margin: 15% auto;';
			var image = document.createElement('img');
			image.alt = "";
			image.width = this.canvasEl.width > 350 ? 300 : this.canvasEl.width;
			image.height = this.canvasEl.height > 300 ? 200 : this.canvasEl.height;
			image.style = 'padding: 2px;margin-bottom: 25px;margin-top: 10px;background: darkgrey;';
			image.src = this.canvasEl.toDataURL();
			var body = document.createElement('p');
			body.textContent = this.dialogBodyText;
			var btnConfirm = document.createElement('button');
			btnConfirm.className = 'signature_confirm_btn';
			btnConfirm.innerHTML = this.dialogBtnConfirm;
			btnConfirm.style = 'background-color: rgb(77 218 63);border: none;border-radius: 5px;padding: 8px;font-size: 16px;color: white;box-shadow: rgb(77 218 63) 0px 6px 18px -5px;margin-right: 15px;cursor: pointer;';
			var btnDecline = document.createElement('button');
			btnDecline.className = 'signature_decline_btn';
			btnDecline.innerHTML = this.dialogBtnDecline;
			btnDecline.style = 'background-color: rgb(237, 103, 85);border: none;border-radius: 5px;padding: 8px;font-size: 16px;color: white;box-shadow: rgb(237 103 85) 0px 6px 18px -5px;cursor: pointer;';


			dialog.appendChild(image);
			dialog.appendChild(body);
			dialog.appendChild(btnConfirm);
			dialog.appendChild(btnDecline);
			background.appendChild(dialog);

			document.getElementsByTagName("body")[0].appendChild(background);

			if (this.fncOnDecline !== undefined) {
				btnDecline.onclick = this.fncOnDecline;
			}
			
			if (this.fncOnConfirm !== undefined) {
				btnConfirm.onclick = this.fncOnConfirm;
			}
		}
	}

});