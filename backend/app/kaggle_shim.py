"""
Makes `test_array.npy` loadable.

`test_array.npy` was saved inside a Kaggle notebook. It is a numpy array of
`kaggle_support.Planet` objects, and those objects also reference classes from
`ariel_transit`. Those two modules are not part of this project, so a plain
`np.load(..., allow_pickle=True)` fails with `ModuleNotFoundError`.

We do not need the original *behaviour* of those classes - we only want the
plain numbers stored inside them (the spectrum array and the transit
parameters). So we register fake ("shim") modules that hand back an empty
placeholder class for any name pickle asks for. Pickle fills the placeholder's
`__dict__` with the stored attributes and we read them normally.
"""

import sys
import types


class _Placeholder:
    """An empty object that pickle can pour attributes into."""

    def __init__(self, *args, **kwargs):
        pass

    def __setstate__(self, state):
        if isinstance(state, dict):
            self.__dict__.update(state)
        else:
            self.__dict__["_state"] = state


def _make_fake_module(name: str) -> None:
    """Register a module whose every attribute is a fresh placeholder class."""
    module = types.ModuleType(name)
    created: dict[str, type] = {}

    def __getattr__(attr: str):
        if attr not in created:
            created[attr] = type(attr, (_Placeholder,), {"__module__": name})
        return created[attr]

    module.__getattr__ = __getattr__  # type: ignore[attr-defined]
    sys.modules[name] = module


# Enough to unpickle test_array.npy.
_FAKE_MODULES = ["kaggle_support", "ariel_transit"]

# Everything else stage2_model.pickle reaches for. `cupy` is handled separately
# in install() because its arrays have to become real numpy arrays.
_MODEL_MODULES = [
    "ariel_model",
    "ariel_load",
    "ariel_gp",
    "ariel_pca",
    "ariel_simple2",
    "loaders",
    "model_options",
    "ariel_load_FGS",
    "ariel_load_AIRS",
    "apply_pixel_corrections",
    "apply_full_sensor_corrections",
    "pca_options",
    "apply_time_binning",
    "modify_func",
    "transits",
    "data",
]


def install(include_model_modules: bool = False) -> None:
    """
    Call this once before unpickling anything that came from Kaggle.

    `include_model_modules=True` also stubs the modules that
    `stage2_model.pickle` needs, including a minimal `cupy` whose arrays are
    plain numpy arrays (the pickle stores GPU arrays, but we only want the
    numbers, and numpy holds them fine).
    """
    names = _FAKE_MODULES + (_MODEL_MODULES if include_model_modules else [])
    for name in names:
        if name not in sys.modules:
            _make_fake_module(name)

    if include_model_modules and "cupy" not in sys.modules:
        import numpy as np

        for name in ("cupy", "cupy._core", "cupy._core.core"):
            module = types.ModuleType(name)
            module.array = np.array  # type: ignore[attr-defined]
            module.asarray = np.asarray  # type: ignore[attr-defined]
            module.ndarray = np.ndarray  # type: ignore[attr-defined]
            sys.modules[name] = module
