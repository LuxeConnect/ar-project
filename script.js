async function init() {
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const ctx = canvas.getContext('2d');
    const thresholdSlider = document.getElementById('threshold');
    const thresholdValue = document.getElementById('thresholdValue');
    const minAreaSlider = document.getElementById('minArea');
    const minAreaValue = document.getElementById('minAreaValue');

    let threshold = parseInt(thresholdSlider.value, 10);
    let minArea = parseInt(minAreaSlider.value, 10);
    thresholdValue.textContent = threshold;
    minAreaValue.textContent = minArea;

    thresholdSlider.addEventListener('input', (e) => {
        threshold = parseInt(e.target.value, 10);
        thresholdValue.textContent = threshold;
    });

    minAreaSlider.addEventListener('input', (e) => {
        minArea = parseInt(e.target.value, 10);
        minAreaValue.textContent = minArea;
    });

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } } // Низкое разрешение для стабильности
        });
        video.srcObject = stream;
        video.play();
    } catch (err) {
        console.error('Ошибка доступа к камере:', err);
        alert('Пожалуйста, разрешите доступ к камере.');
        return;
    }

    video.addEventListener('loadedmetadata', () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        renderLoop();
    });

    let boxes = [];

    function isDark(r, g, b, thresh) {
        const brightness = (r * 0.299 + g * 0.587 + b * 0.114);
        return brightness < thresh;
    }

    function floodFill(x, y, data, width, height, visited, thresh) {
        const stack = [[x, y]];
        const bbox = { minX: x, maxX: x, minY: y, maxY: y };
        let area = 0;

        while (stack.length) {
            const [cx, cy] = stack.pop();
            const idx = (cy * width + cx) * 4;
            if (cx < 0 || cx >= width || cy < 0 || cy >= height || visited[idx / 4] || !isDark(data[idx], data[idx + 1], data[idx + 2], thresh)) continue;

            visited[idx / 4] = true;
            area++;

            bbox.minX = Math.min(bbox.minX, cx);
            bbox.maxX = Math.max(bbox.maxX, cx);
            bbox.minY = Math.min(bbox.minY, cy);
            bbox.maxY = Math.max(bbox.maxY, cy);

            stack.push([cx + 1, cy]);
            stack.push([cx - 1, cy]);
            stack.push([cx, cy + 1]);
            stack.push([cx, cy - 1]);
        }

        return area >= minArea ? bbox : null;
    }

    function detectDarkAreas(thresh, minArea) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width / 2; // Масштабирование для оптимизации
        tempCanvas.height = canvas.height / 2;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const data = imageData.data;

        const visited = new Array(tempCanvas.width * tempCanvas.height).fill(false);
        const newBoxes = [];

        let darkPixels = 0;
        for (let i = 0; i < data.length; i += 4) {
            if (isDark(data[i], data[i + 1], data[i + 2], thresh)) darkPixels++;
        }

        for (let y = 0; y < tempCanvas.height; y++) {
            for (let x = 0; x < tempCanvas.width; x++) {
                const idx = (y * tempCanvas.width + x) * 4;
                if (!visited[idx / 4] && isDark(data[idx], data[idx + 1], data[idx + 2], thresh)) {
                    const bbox = floodFill(x, y, data, tempCanvas.width, tempCanvas.height, visited, thresh);
                    if (bbox) newBoxes.push(bbox);
                }
            }
        }

        boxes = newBoxes.map(box => ({
            x: box.minX * 2,
            y: box.minY * 2,
            width: (box.maxX - box.minX + 1) * 2,
            height: (box.maxY - box.minY + 1) * 2
        }));
        console.log(`Тёмных пикселей: ${darkPixels}, Обнаружено областей: ${boxes.length}`);
    }

    function renderLoop() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height); // Рендерим видео
        ctx.strokeStyle = '#00FF00';
        ctx.lineWidth = 3;
        boxes.forEach(box => {
            ctx.strokeRect(box.x, box.y, box.width, box.height);
        });
        requestAnimationFrame(renderLoop);
    }

    // Обновление детекции с интервалом
    setInterval(() => {
        detectDarkAreas(threshold, minArea);
    }, 200);
}

init();
