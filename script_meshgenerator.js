(function(window) {
    'use strict';
    window.SIMULOBJET = window.SIMULOBJET || {};

    class MeshGenerator {
        generateSweptMesh(layers, density = 10) {
            const nodes = [];
            const elements = [];
            const nodeMap = new Map();
            let nodeIndex = 0;

            const getNodeIndex = (x, y, z) => {
                const key = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
                if (!nodeMap.has(key)) {
                    nodeMap.set(key, nodeIndex);
                    nodes.push([x, y, z]);
                    nodeIndex++;
                }
                return nodeMap.get(key);
            };

            for (const layer of layers) {
                const dim = layer.dimensions;
                const pos = layer.position;

                const startX = pos.x - dim.w / 2;
                const startZ = pos.z - dim.d / 2;
                
                const numDivX = Math.max(1, Math.round(dim.w / density));
                const numDivZ = Math.max(1, Math.round(dim.d / density));
                const stepX = dim.w / numDivX;
                const stepZ = dim.d / numDivZ;

                for (let i = 0; i < numDivX; i++) {
                    for (let j = 0; j < numDivZ; j++) {
                        const x0 = startX + i * stepX;
                        const z0 = startZ + j * stepZ;
                        const x1 = x0 + stepX;
                        const z1 = z0 + stepZ;

                        const subPoly = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
                        const vertices = subPoly.flat();
                        const triangleIndices = earcut(vertices, null, 2);

                        const y_bottom = pos.y - dim.h / 2;
                        const y_top = pos.y + dim.h / 2;
                        
                        const bottomNodeIndices = subPoly.map(p => getNodeIndex(p[0], y_bottom, p[1]));
                        const topNodeIndices = subPoly.map(p => getNodeIndex(p[0], y_top, p[1]));

                        for (let k = 0; k < triangleIndices.length; k += 3) {
                            const i1 = triangleIndices[k], i2 = triangleIndices[k+1], i3 = triangleIndices[k+2];
                            elements.push({
                                type: 'WEDGE6',
                                // --- 수정된 부분 시작 ---
                                // 노드 순서를 [i1, i2, i3]에서 [i1, i3, i2]로 변경하여 요소의 "뒤집힘" 현상을 바로잡습니다.
                                // 이는 detJ가 음수가 되는 문제를 해결합니다.
                                nodes: [
                                    bottomNodeIndices[i1], bottomNodeIndices[i3], bottomNodeIndices[i2],
                                    topNodeIndices[i1],    topNodeIndices[i3],    topNodeIndices[i2]
                                ],
                                // --- 수정된 부분 끝 ---
                                color: layer.color
                            });
                        }
                    }
                }
            }
            return { nodes, elements };
        }
    }
    window.SIMULOBJET.MeshGenerator = MeshGenerator;
})(window);