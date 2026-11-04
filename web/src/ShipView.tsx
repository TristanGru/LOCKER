import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  Box,
  FlipHorizontal2,
  Focus,
  Layers,
  Scissors,
  Ship,
  Waves,
} from "lucide-react";
import { buildDDG } from "./shipModel";
import type { Forecast, Mission, VisualRegistry } from "./types";
import { dateLabel, percent, tone, toneLabel } from "./ui";

interface Props {
  registry: VisualRegistry;
  forecast: Forecast;
  mission: Mission;
  ship: { name: string; hull: string };
  selected: string | null;
  onSelect: (eic: string) => void;
}
type CameraView = "iso" | "sky" | "side";
const colors = {
  ready: 0x65d6ad,
  watch: 0xf5c965,
  risk: 0xff7c86,
  unknown: 0x8797aa,
};

export default function ShipView(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const controller = useRef<{
    update: () => void;
    view: (view: CameraView) => void;
  } | null>(null);
  const current = useRef(props);
  const [mode, setMode] = useState<"event" | "material">("event"),
    [day, setDay] = useState(0),
    [xray, setXray] = useState(true),
    [sea, setSea] = useState(true),
    [cut, setCut] = useState(false),
    [axis, setAxis] = useState<"x" | "z">("x"),
    [flipped, setFlipped] = useState(false),
    [filter, setFilter] = useState("all"),
    [cameraView, setCameraView] = useState<CameraView>("iso"),
    [failure, setFailure] = useState("");
  const settings = useRef({ mode, day, xray, sea, cut, axis, flipped, filter });
  const selectedInfo = props.registry.systems.find(
    (item) => item.eic === props.selected,
  );
  const score = (eic: string) => {
    const system = props.registry.systems.find((item) => item.eic === eic);
    if (!system) return null;
    if (mode === "event")
      return (
        props.mission?.gates.find(
          (item) => item.gate_id === `system:${system.system_eic}`,
        )?.p_ok ?? null
      );
    return (
      props.forecast.ships[props.mission.ship_id]?.systems[system.system_eic]?.[
        day
      ] ?? null
    );
  };
  useEffect(() => {
    current.current = props;
    settings.current = { mode, day, xray, sea, cut, axis, flipped, filter };
    controller.current?.update();
  }, [props, mode, day, xray, sea, cut, axis, flipped, filter]);
  useEffect(() => {
    if (!host.current) return;
    const container = host.current;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
      });
    } catch {
      setFailure(
        "3D rendering is unavailable. All systems and source records remain accessible in the list below.",
      );
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setClearColor(0x0d1b28, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5;
    renderer.localClippingEnabled = true;
    renderer.domElement.dataset.testid = "ship-canvas";
    renderer.domElement.setAttribute(
      "aria-label",
      "Interactive illustrative destroyer; equivalent system controls below",
    );
    renderer.domElement.setAttribute("role", "img");
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(40, 1, 0.1, 2000);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 45;
    controls.maxDistance = 550;
    controls.maxPolarAngle = Math.PI * 0.84;
    const ambient = new THREE.HemisphereLight(0xc9e7ff, 0x354850, 2.8);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xfff0db, 3);
    key.position.set(35, 100, 50);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x90d9ff, 2);
    rim.position.set(-70, 35, -70);
    scene.add(rim);
    const model = buildDDG().g as THREE.Group;
    const materialCopies = new Map<THREE.Material, THREE.Material>();
    model.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const original = object.material as THREE.Material;
      if (!materialCopies.has(original))
        materialCopies.set(original, original.clone());
      object.material = materialCopies.get(original)!;
    });
    scene.add(model);
    const interior = new THREE.Group();
    for (const height of [2.4, 5.1, 7.7]) {
      const geometry = new THREE.BoxGeometry(105, 0.18, 14);
      const deck = new THREE.Mesh(
        geometry,
        new THREE.MeshStandardMaterial({
          color: 0x658d98,
          side: THREE.DoubleSide,
          roughness: 0.8,
        }),
      );
      deck.position.set(-7, height, 0);
      interior.add(deck);
    }
    for (const position of [-45, -25, -5, 15, 35]) {
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 8, 13),
        new THREE.MeshStandardMaterial({
          color: 0x54727c,
          side: THREE.DoubleSide,
        }),
      );
      frame.position.set(position, 4, 0);
      interior.add(frame);
    }
    scene.add(interior);
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(650, 650),
      new THREE.MeshStandardMaterial({
        color: 0x174b60,
        transparent: true,
        opacity: 0.28,
        roughness: 0.55,
        depthWrite: false,
      }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = 4.9;
    scene.add(water);
    const grid = new THREE.GridHelper(350, 35, 0x365d6b, 0x23434f);
    grid.position.y = -0.3;
    scene.add(grid);
    const pinGroup = new THREE.Group();
    scene.add(pinGroup);
    const pins: {
      mesh: THREE.Mesh;
      halo: THREE.Mesh;
      eic: string;
      parent: string;
      position: THREE.Vector3;
    }[] = [];
    for (const system of current.current.registry.systems) {
      for (const mount of system.mounts) {
        const point = current.current.registry.mounts[mount];
        if (!point) continue;
        const position = new THREE.Vector3(...point);
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(1.35, 18, 12),
          new THREE.MeshStandardMaterial({
            color: colors.unknown,
            emissive: colors.unknown,
            emissiveIntensity: 0.55,
            depthTest: false,
          }),
        );
        mesh.position.copy(position);
        mesh.renderOrder = 10;
        mesh.userData.eic = system.eic;
        pinGroup.add(mesh);
        const halo = new THREE.Mesh(
          new THREE.TorusGeometry(2.5, 0.13, 8, 36),
          new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false }),
        );
        halo.position.copy(position);
        halo.renderOrder = 11;
        halo.rotation.x = -Math.PI / 2;
        pinGroup.add(halo);
        pins.push({
          mesh,
          halo,
          eic: system.eic,
          parent: system.system_eic,
          position,
        });
      }
    }
    const plane = new THREE.Plane();
    function update() {
      const latest = current.current,
        options = settings.current;
      const selected = latest.registry.systems.find(
        (item) => item.eic === latest.selected,
      );
      const position = selected
        ? latest.registry.mounts[selected.mounts[0]] || [0, 0, 0]
        : [0, 0, 0];
      plane.normal.set(
        options.axis === "x" ? 1 : 0,
        0,
        options.axis === "z" ? 1 : 0,
      );
      plane.constant = -(options.axis === "x" ? position[0] : position[2]);
      if (options.flipped) plane.negate();
      for (const group of [model, interior])
        group.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          const material = object.material as THREE.MeshStandardMaterial;
          material.clippingPlanes = options.cut ? [plane] : [];
          const hull = /hull|boot|antifouling|deck_nonskid/.test(material.name);
          material.transparent = options.xray && hull;
          material.opacity = material.transparent ? 0.38 : 1;
          material.depthWrite = !material.transparent;
          material.needsUpdate = true;
        });
      interior.visible = options.cut || options.xray;
      water.visible = options.sea;
      for (const pin of pins) {
        const value =
          options.mode === "event"
            ? (latest.mission?.gates.find(
                (gate) => gate.gate_id === `system:${pin.parent}`,
              )?.p_ok ?? null)
            : (latest.forecast.ships[latest.mission.ship_id]?.systems[
                pin.parent
              ]?.[options.day] ?? null);
        const status = tone(
          value,
          options.mode === "event"
            ? latest.forecast.bands
            : { green: 0.8, yellow: 0.6 },
        );
        const material = pin.mesh.material as THREE.MeshStandardMaterial;
        material.color.setHex(colors[status]);
        material.emissive.setHex(colors[status]);
        pin.mesh.visible =
          options.filter === "all" ||
          (options.filter === "below"
            ? pin.position.y < 10
            : pin.position.y >= 10);
        pin.halo.visible =
          pin.mesh.visible &&
          (pin.eic === latest.selected ||
            latest.mission.next_domino === `system:${pin.parent}`);
        (pin.halo.material as THREE.MeshBasicMaterial).color.setHex(
          pin.eic === latest.selected ? 0xffffff : colors[status],
        );
        pin.mesh.scale.setScalar(pin.eic === latest.selected ? 1.4 : 1);
      }
    }
    let lastView: CameraView = "iso";
    function fit(view: CameraView) {
      lastView = view;
      if (container.clientWidth < 1 || container.clientHeight < 1) return;
      const aspect =
          container.clientWidth / Math.max(container.clientHeight, 1),
        tangent = Math.tan(THREE.MathUtils.degToRad(20));
      const distance = Math.max(78 / (tangent * aspect), 52 / tangent) * 1.22;
      const direction =
        view === "sky"
          ? new THREE.Vector3(0, 1, 0.001)
          : view === "side"
            ? new THREE.Vector3(0, 0.15, 1)
            : new THREE.Vector3(0.5, 0.7, 1);
      controls.target.set(0, 8, 0);
      camera.position
        .copy(controls.target)
        .add(direction.normalize().multiplyScalar(distance));
      controls.update();
    }
    let userMoved = false;
    controls.addEventListener("start", () => {
      userMoved = true;
    });
    const resize = new ResizeObserver(() => {
      const width = container.clientWidth,
        height = container.clientHeight;
      if (width < 1 || height < 1) return;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      if (!userMoved) fit(lastView);
    });
    resize.observe(container);
    const raycaster = new THREE.Raycaster(),
      pointer = new THREE.Vector2();
    let pressed = [0, 0];
    const pointerDown = (event: PointerEvent) => {
      pressed = [event.clientX, event.clientY];
    };
    const pointerUp = (event: PointerEvent) => {
      if (
        Math.hypot(event.clientX - pressed[0], event.clientY - pressed[1]) > 5
      )
        return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        (-(event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(
        pins.filter((pin) => pin.mesh.visible).map((pin) => pin.mesh),
      )[0];
      if (hit) current.current.onSelect(hit.object.userData.eic);
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    const lost = (event: Event) => {
      event.preventDefault();
      setFailure(
        "The 3D context was lost. Use the system list, or reopen this view to retry.",
      );
    };
    renderer.domElement.addEventListener("webglcontextlost", lost);
    controller.current = {
      update,
      view: (view) => {
        userMoved = false;
        fit(view);
      },
    };
    renderer.setSize(container.clientWidth, container.clientHeight);
    camera.aspect = container.clientWidth / Math.max(container.clientHeight, 1);
    camera.updateProjectionMatrix();
    update();
    fit("iso");
    renderer.render(scene, camera);
    renderer.setAnimationLoop(() => {
      controls.update();
      try {
        renderer.render(scene, camera);
      } catch (error) {
        renderer.setAnimationLoop(null);
        throw new Error(
          `${String(error)}; clipping=${JSON.stringify({ normal: plane.normal.toArray(), constant: plane.constant })}; camera=${JSON.stringify(camera.matrixWorldInverse.toArray())}`,
        );
      }
    });
    return () => {
      controller.current = null;
      renderer.setAnimationLoop(null);
      resize.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      const geometries = new Set<THREE.BufferGeometry>(),
        materials = new Set<THREE.Material>();
      scene.traverse((object) => {
        if (
          object instanceof THREE.Mesh ||
          object instanceof THREE.LineSegments
        ) {
          geometries.add(object.geometry);
          (Array.isArray(object.material)
            ? object.material
            : [object.material]
          ).forEach((material) => materials.add(material));
        }
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, []);
  const legendBands =
    mode === "event" ? props.forecast.bands : { green: 0.8, yellow: 0.6 };
  return (
    <div className="ship-view">
      <div className="viewer-tools">
        <div className="segmented" role="group" aria-label="Assessment mode">
          <button
            className={mode === "event" ? "selected" : ""}
            onClick={() => setMode("event")}
          >
            Event requirements
          </button>
          <button
            className={mode === "material" ? "selected" : ""}
            onClick={() => setMode("material")}
          >
            Material state
          </button>
        </div>
        <div className="camera-tools">
          {(["iso", "sky", "side"] as CameraView[]).map((view) => (
            <button
              key={view}
              className={`icon-button ${cameraView === view ? "selected" : ""}`}
              title={`${view} view`}
              aria-label={`${view} view`}
              onClick={() => {
                setCameraView(view);
                controller.current?.view(view);
              }}
            >
              {view === "iso" ? (
                <Box size={17} />
              ) : view === "sky" ? (
                <Layers size={17} />
              ) : (
                <Ship size={17} />
              )}
            </button>
          ))}
          <button
            className="icon-button"
            title="Reset camera"
            aria-label="Reset camera"
            onClick={() => controller.current?.view(cameraView)}
          >
            <Focus size={17} />
          </button>
        </div>
      </div>
      <div className="ship-stage" ref={host}>
        {failure && (
          <div className="webgl-fallback" role="alert">
            {failure}
          </div>
        )}
        <div className="model-caption">
          <strong>{props.ship.name}</strong>
          <span>{props.ship.hull} / illustrative DDG</span>
        </div>
        {selectedInfo && (
          <div className="selected-caption">
            <span className={tone(score(selectedInfo.eic), legendBands)}>
              {mode === "material" && score(selectedInfo.eic) != null
                ? `${(score(selectedInfo.eic)! * 100).toFixed(0)} / 100`
                : percent(score(selectedInfo.eic))}
            </span>
            <strong>{selectedInfo.name}</strong>
            <small>
              {selectedInfo.eic === selectedInfo.system_eic
                ? "System aggregate"
                : "Parent-system assessment; inspect component evidence"}
            </small>
          </div>
        )}
      </div>
      <div className="viewer-options">
        <label>
          <input
            type="checkbox"
            checked={xray}
            onChange={(event) => setXray(event.target.checked)}
          />
          X-ray
        </label>
        <label>
          <input
            type="checkbox"
            checked={sea}
            onChange={(event) => setSea(event.target.checked)}
          />
          <Waves size={14} />
          Sea
        </label>
        <label>
          <input
            type="checkbox"
            checked={cut}
            onChange={(event) => setCut(event.target.checked)}
          />
          <Scissors size={14} />
          Section
        </label>
        {cut && (
          <>
            <select
              aria-label="Section direction"
              value={axis}
              onChange={(event) => setAxis(event.target.value as "x" | "z")}
            >
              <option value="x">Across</option>
              <option value="z">Lengthwise</option>
            </select>
            <button
              className="icon-button"
              aria-label="Flip section"
              title="Flip section"
              onClick={() => setFlipped(!flipped)}
            >
              <FlipHorizontal2 size={15} />
            </button>
          </>
        )}
        <select
          aria-label="Visible systems"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option value="all">All systems</option>
          <option value="above">Above deck</option>
          <option value="below">Below deck</option>
        </select>
      </div>
      {mode === "material" ? (
        <label className="assessment-slider">
          <span>
            Assessment date{" "}
            <strong>{dateLabel(props.forecast.grid_dates[day])}</strong>
          </span>
          <input
            aria-label="Assessment date"
            type="range"
            min="0"
            max={props.forecast.grid_dates.length - 1}
            value={day}
            onChange={(event) => setDay(Number(event.target.value))}
          />
          <small>Mean material score / 100. Not probability.</small>
        </label>
      ) : (
        <p className="fine-print">
          Event interval: {dateLabel(props.mission.start)}–{dateLabel(props.mission.end)}. Colors indicate
          probability of meeting each system requirement across interval checks.
        </p>
      )}
      <div className="viewer-legend">
        <span className="ready">
          {mode === "material" ? "Operable" : "Ready"} ≥{" "}
          {mode === "material" ? "80" : percent(legendBands.green)}
        </span>
        <span className="watch">
          {mode === "material" ? "Degraded" : "Watch"} ≥{" "}
          {mode === "material" ? "60" : percent(legendBands.yellow)}
        </span>
        <span className="risk">
          {mode === "material" ? "Low material score" : "At risk"}
        </span>
        <span className="unknown">Not a gate / unknown</span>
      </div>
      <p className="fine-print">
        Illustrative geometry and section decks, not a verified DTMB asset or
        actual compartment layout.
      </p>
      <div className="system-grid">
        {props.registry.systems
          .filter(
            (item) =>
              filter === "all" ||
              item.mounts.some(
                (mount) =>
                  props.registry.mounts[mount] && (props.registry.mounts[mount][1] < 10) === (filter === 'below'),
              ),
          )
          .map((item) => {
            const value = score(item.eic),
              state = tone(value, legendBands);
            return (
              <button
                className={`${state} ${props.selected === item.eic ? "selected" : ""}`}
                key={item.eic}
                onClick={() => props.onSelect(item.eic)}
              >
                <i />
                <span>
                  {item.name}
                  <small>{item.eic}{!item.mounts.length && ' / No mount on this hull'}</small>
                </span>
                <b>
                  {value == null
                    ? 'Unknown / not a gate'
                    : mode === "material"
                      ? `${Math.round(value * 100)}/100`
                      : percent(value)}
                </b>
              </button>
            );
          })}
      </div>
    </div>
  );
}
