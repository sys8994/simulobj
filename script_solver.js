(function(window) {
    'use strict';
    window.SIMULOBJET = window.SIMULOBJET || {};
    if (typeof math === 'undefined') { console.error('math.js library not loaded.'); return; }

    class Solver {
        /**
         * 각 6절점 쐐기 요소(Wedge6)에 대한 강성 행렬(stiffness matrix)을 계산합니다.
         * 이 계산은 유한요소법(FEM)의 핵심 원리를 따르며, 각 요소의 실제 기하학적 형태를 반영합니다.
         * @param {number[][]} elementNodesCoords - 요소를 구성하는 6개 절점의 [x, y, z] 좌표 배열.
         * @returns {number[][]} - 계산된 6x6 요소 강성 행렬.
         */
        calculateWedge6Stiffness(elementNodesCoords) {
            // 열전도율(thermal conductivity), 실제 물질의 속성을 반영해야 함. 여기서는 1로 가정.
            const thermalConductivity = 1.0;

            // 쐐기 요소의 자연 좌표계(natural coordinates) 중심(ksi=1/3, eta=1/3, zeta=0)에서의
            // 형상 함수(shape function) 미분값. 단일 적분점(single Gauss point)을 사용한 수치 적분을 위함.
            const dN_d_natural = math.matrix([
                [-0.5, 0.5, 0.0, -0.5, 0.5, 0.0],
                [-0.5, 0.0, 0.5, -0.5, 0.0, 0.5],
                [-1/6, -1/6, -1/6, 1/6, 1/6, 1/6]
            ]);

            // 자코비안 행렬(Jacobian matrix) 계산. 자연 좌표계에서 전역 좌표계로의 변환을 위함.
            // J = [dx/d_ksi, dy/d_ksi, dz/d_ksi]
            //     [dx/d_eta, dy/d_eta, dz/d_eta]
            //     [dx/d_zeta, dy/d_zeta, dz/d_zeta]
            const J = math.multiply(dN_d_natural, elementNodesCoords);

            // 자코비안 행렬의 행렬식(determinant)과 역행렬(inverse) 계산.
            const detJ = math.det(J);
            if (detJ <= 0) {
                // 요소가 비정상이거나(찌그러짐 등) 절점 순서가 잘못된 경우.
                console.warn("Invalid element geometry detected (non-positive Jacobian determinant). Skipping element.");
                return math.zeros(6, 6).toArray(); // 오류 발생 시 강성 행렬을 0으로 반환.
            } else {console.log('good')}
            const invJ = math.inv(J);

            // 전역 좌표계(x, y, z)에 대한 형상 함수의 미분값(B 행렬) 계산.
            // B 행렬은 온도 구배(gradient)와 절점 온도를 연결하는 역할을 함.
            const B_matrix = math.multiply(invJ, dN_d_natural);

            // 요소 강성 행렬(k_e) 계산.
            // k_e = integral(B^T * k * B * dV)
            // 수치 적분을 통해 근사화 (여기서는 단일 적분점 사용).
            const B_transpose_B = math.multiply(math.transpose(B_matrix), B_matrix);
            const weight = 1.0; // 단일 적분점의 가중치.
            const k_e = math.multiply(B_transpose_B, thermalConductivity * detJ * weight);

            return k_e.toArray();
        }

        solveSteadyStateHeat(meshData, highTemp, lowTemp) {
            const { nodes, elements } = meshData;
            const numNodes = nodes.length;

            const K_data = Array(numNodes).fill(0).map(() => Array(numNodes).fill(0));
            const F_data = Array(numNodes).fill(0);

            // --- 수정된 부분 시작 ---
            // 각 요소를 순회하며 기하학적 특성을 반영한 강성 행렬을 계산하고 전체 강성 행렬(K)에 더함.
            for (const el of elements) {
                // 요소의 절점 좌표를 가져옴.
                const elementNodesCoords = el.nodes.map(nodeIndex => nodes[nodeIndex]);
                
                // 해당 요소의 강성 행렬(k_e)을 계산.
                const k_e = this.calculateWedge6Stiffness(elementNodesCoords);

                // 계산된 요소 강성 행렬을 전체(Global) 강성 행렬에 조립(Assembly).
                for (let i = 0; i < 6; i++) {
                    for (let j = 0; j < 6; j++) {
                        const global_i = el.nodes[i];
                        const global_j = el.nodes[j];
                        K_data[global_i][global_j] += k_e[i][j];
                    }
                }
            }
            // --- 수정된 부분 끝 ---

            const boundaryNodes = this.findBoundaryNodes(nodes);
            const penalty = 1e12;
            for (const nodeIndex of boundaryNodes.high) {
                K_data[nodeIndex][nodeIndex] += penalty;
                F_data[nodeIndex] += penalty * highTemp;
            }
            for (const nodeIndex of boundaryNodes.low) {
                K_data[nodeIndex][nodeIndex] += penalty;
                F_data[nodeIndex] += penalty * lowTemp;
            }

            try {
                const K = math.matrix(K_data);
                const F = math.matrix(F_data);
                const T_vector = math.lusolve(K, F);

                console.log("Solver finished successfully.");
                return T_vector.toArray().flat();
            } catch (err) {
                console.error("Failed to solve the linear system:", err);
                return Array(numNodes).fill((highTemp + lowTemp) / 2);
            }
        }

        findBoundaryNodes(nodes) {
            let minX = Infinity, maxX = -Infinity;
            nodes.forEach(n => {
                if (n[0] < minX) minX = n[0];
                if (n[0] > maxX) maxX = n[0];
            });
            const tolerance = 1e-3;
            const high = [], low = [];
            nodes.forEach((n, index) => {
                if (Math.abs(n[0] - minX) < tolerance) high.push(index);
                else if (Math.abs(n[0] - maxX) < tolerance) low.push(index);
            });
            return { high, low };
        }
    }
    window.SIMULOBJET.Solver = Solver;
})(window);