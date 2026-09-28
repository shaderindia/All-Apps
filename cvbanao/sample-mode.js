window.CV_SAMPLE_MODE = new URLSearchParams(window.location.search).get('sample') === '1';
if (window.CV_SAMPLE_MODE) document.documentElement.classList.add('sample-preview');
