(function(window) {
    'use strict';

    window.SIMULOBJET = window.SIMULOBJET || {};

    class StructureBuilder {
        constructor() {
            this.deviceLayers = [
                { name: 'Substrate (Si)', color: 0x888888, dimensions: { w: 100, h: 20, d: 100 }, position: { x: 0, y: -10, z: 0 } },
                { name: 'Oxide (SiO2)', color: 0x00aaff, dimensions: { w: 80, h: 10, d: 80 }, position: { x: 0, y: 5, z: 0 } },
                { name: 'Metal 1 (W)', color: 0xcccccc, dimensions: { w: 10, h: 15, d: 60 }, position: { x: -20, y: 17.5, z: 0 } },
                { name: 'Metal 2 (Cu)', color: 0xffaa00, dimensions: { w: 10, h: 15, d: 60 }, position: { x: 20, y: 17.5, z: 0 } }
            ];
        }

        getDeviceLayers() {
            return this.deviceLayers;
        }
    }

    window.SIMULOBJET.StructureBuilder = StructureBuilder;

})(window);