import {
  fileForContentTypes,
  FileForRelThumbnail,
  to3dmodel,
} from "@jscadui/3mf-export";
import type { Manifold } from "manifold-3d";

import * as THREE from "three";
import { strToU8, Zippable, zipSync } from "fflate";

interface To3MF {
  meshes: Array<Mesh3MF>;
  components: [];
  items: [{ objectID: string }];
  precision: number;
  header: Header;
}

interface Mesh3MF {
  id: string;
  vertices: Float32Array;
  indices: Uint32Array;
  name?: string;
}

interface Header {
  unit?: "micron" | "millimeter" | "centimeter" | "inch" | "foot" | "meter";
  title?: string;
  author?: string;
  description?: string;
  application?: string;
  creationDate?: string;
  license?: string;
  modificationDate?: string;
}

export function exportManifold(manifold: Manifold): Blob {
  const manifoldMesh = manifold.getMesh();

  const vertices =
    manifoldMesh.numProp === 3
      ? manifoldMesh.vertProperties
      : new Float32Array(manifoldMesh.numVert * 3);

  if (manifoldMesh.numProp > 3) {
    for (let i = 0; i < manifoldMesh.numVert; ++i) {
      for (let j = 0; j < 3; ++j)
        vertices[i * 3 + j] =
          manifoldMesh.vertProperties[i * manifoldMesh.numProp + j];
    }
  }

  const to3mf: To3MF = {
    meshes: [{ vertices, indices: manifoldMesh.triVerts, id: "0" }],
    components: [],
    items: [{ objectID: "0" }],
    precision: 7,

    header: {
      unit: "millimeter",
      title: "skapa-ikea-skadis",
      description: "",
      application: "",
    },
  };

  const model = to3dmodel(to3mf);

  const files: Zippable = {};

  const fileForRelThumbnail = new FileForRelThumbnail();
  fileForRelThumbnail.add3dModel("3D/3dmodel.model");
  files["3D/3dmodel.model"] = strToU8(model);
  files[fileForContentTypes.name] = strToU8(fileForContentTypes.content);
  files[fileForRelThumbnail.name] = strToU8(fileForRelThumbnail.content);
  const zipFile = zipSync(files);

  return new Blob([zipFile], {
    type: "application/vnd.ms-package.3dmanufacturing-3dmodel+xml",
  });
}

export function mesh2geometry(manifold: Manifold): THREE.BufferGeometry {
  const mesh = manifold.getMesh();
  const geometry = new THREE.BufferGeometry();
  const verts: Float32Array = new Float32Array(3 * mesh.triVerts.length);

  // List the indices, and for each copy the original vertex.
  // This allows use to use computeVertexNormals in three.js.
  mesh.triVerts.forEach((ix, i) => {
    verts[3 * i + 0] = mesh.vertProperties[3 * ix + 0];
    verts[3 * i + 1] = mesh.vertProperties[3 * ix + 1];
    verts[3 * i + 2] = mesh.vertProperties[3 * ix + 2];
  });

  geometry.setAttribute("position", new THREE.BufferAttribute(verts, 3));
  return geometry;
}
