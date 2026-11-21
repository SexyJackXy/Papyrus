/**
 * Skaliert die Fahrzeugübersicht (.parkingSpace) gleichmäßig auf den
 * verfügbaren Platz, damit Hallen, Gates und Cars immer deckungsgleich
 * mit dem Hintergrundbild bleiben.
 */
(function () {
    const DESIGN_W = 1800;
    const DESIGN_H = 950;

    function init() {
        const stage = document.getElementById('stage');
        const space = document.querySelector('.parkingSpace');
        if (!stage || !space) return;

        function fit() {
            const vv = window.visualViewport;
            const viewportW = document.documentElement.clientWidth;
            const viewportH = vv ? vv.height : window.innerHeight;
            const availW = Math.min(stage.parentElement.clientWidth, viewportW);
            const availH = viewportH - stage.getBoundingClientRect().top - 8;
            const scale = Math.min(availW / DESIGN_W, availH / DESIGN_H);

            space.style.transform = 'scale(' + scale + ')';
            stage.style.width = DESIGN_W * scale + 'px';
            stage.style.height = DESIGN_H * scale + 'px';
        }

        fit();
        window.addEventListener('resize', fit);
        window.addEventListener('orientationchange', fit);
        window.addEventListener('load', fit);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();