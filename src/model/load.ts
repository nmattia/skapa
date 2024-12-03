import { exportManifold } from "./export";
import type { Manifold } from "manifold-3d";

// A 3MF loader, that loads the Manifold and makes it available as a 3MF Blob when ready
export class TMFLoader {
  // The exported manifold, when ready
  private loading?: { tmf?: Blob };

  load(manifoldP: Promise<Manifold>) {
    this.loading = {}; // Initialize empty

    // Pass the _current_ "loading" to the promise closure, so that
    // this.loading may be overriden if load() is called again. This
    // ensures we can never take() an outdated model.
    const loading = this.loading;
    manifoldP.then((manifold) => {
      loading.tmf = exportManifold(manifold);
    });
  }

  take(): undefined | Blob {
    const tmf = this.loading?.tmf;
    if (tmf !== undefined) {
      // Ensure the model is taken only once
      this.loading = undefined;
    }
    return tmf;
  }
}