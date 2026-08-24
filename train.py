import h5py
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from sklearn.preprocessing import StandardScaler
import pickle

# ─── Paths ────────────────────────────────────────────────────────────────────
TRAIN_HDF5  = r"TrainingData/SpectralData.hdf5"
TRAIN_AUX   = r"TrainingData/AuxillaryTable.csv"
TRAIN_QT    = r"TrainingData/Ground Truth Package/QuartilesTable.csv"  # 6,766 valid rows with Q1/Q2/Q3
TEST_HDF5   = r"TestData/SpectralData.hdf5"
TEST_AUX    = r"TestData/AuxillaryTable.csv"

# ─── Config ───────────────────────────────────────────────────────────────────
BATCH_SIZE  = 512
EPOCHS      = 50
LR          = 1e-3
VAL_SPLIT   = 0.15
DEVICE      = "cuda" if torch.cuda.is_available() else "cpu"
PARAM_COLS = ["planet_radius", "planet_temp", "log_H2O", "log_CO2", "log_CO", "log_CH4", "log_NH3"]

# Q2 column names in QuartilesTable
Q2_COLS = ["planet_radius_q2", "T_q2", "log_H2O_q2", "log_CO2_q2", "log_CO_q2", "log_CH4_q2", "log_NH3_q2"]
Q1_COLS = ["planet_radius_q1", "T_q1", "log_H2O_q1", "log_CO2_q1", "log_CO_q1", "log_CH4_q1", "log_NH3_q1"]
Q3_COLS = ["planet_radius_q3", "T_q3", "log_H2O_q3", "log_CO2_q3", "log_CO_q3", "log_CH4_q3", "log_NH3_q3"]

# Submission column order
SUBMIT_COLS = [
    "planet_radius_q1","planet_radius_q2","planet_radius_q3",
    "T_q1","T_q2","T_q3",
    "log_H2O_q1","log_H2O_q2","log_H2O_q3",
    "log_CO2_q1","log_CO2_q2","log_CO2_q3",
    "log_CO_q1","log_CO_q2","log_CO_q3",
    "log_CH4_q1","log_CH4_q2","log_CH4_q3",
    "log_NH3_q1","log_NH3_q2","log_NH3_q3",
]

# ─── Dataset ──────────────────────────────────────────────────────────────────
# Only the AIRS-CH0 band (1.95-3.89 um, 33 of the 52 bins) is used as input, since
# that's the only band stage 1 (spectrum extraction from light curves) can produce.
# The wavelength grid is identical across all planets, so the mask is computed once.
AIRS_CH0_LO, AIRS_CH0_HI = 1.95, 3.89

def _airs_ch0_mask(hdf5_path):
    with h5py.File(hdf5_path, "r") as f:
        first_key = next(iter(f.keys()))
        wl = np.array(f[first_key]["instrument_wlgrid"], dtype=np.float32)
    return (wl >= AIRS_CH0_LO) & (wl <= AIRS_CH0_HI)


def load_hdf5_features(hdf5_path):
    """Returns dict: planet_id -> (spectrum(33), noise(33), transit_depth(33)) for the AIRS-CH0 band.

    transit_depth is instrument_spectrum again — instrument_spectrum already IS the
    transit depth in this dataset, there's no separate field for it in the HDF5.
    """
    mask = _airs_ch0_mask(hdf5_path)
    data = {}
    with h5py.File(hdf5_path, "r") as f:
        for key in f.keys():
            planet_id = key.replace("Planet_", "")  # e.g. train1, public1
            spec  = np.array(f[key]["instrument_spectrum"], dtype=np.float32)[mask]
            noise = np.array(f[key]["instrument_noise"],    dtype=np.float32)[mask]
            transit_depth = spec
            data[planet_id] = np.concatenate([spec, noise, transit_depth])  # (99,)
    return data


AUX_FEATURES = ["star_mass_kg","star_radius_m","star_temperature",
                 "planet_mass_kg","planet_orbital_period"]

class ExoDataset(Dataset):
    def __init__(self, hdf5_path, aux_csv, gt_csv=None,
                 scaler_X=None, scaler_y=None, fit_scalers=False):
        spectral = load_hdf5_features(hdf5_path)
        aux = pd.read_csv(aux_csv)

        # Build X
        X_list, ids = [], []
        for _, row in aux.iterrows():
            pid = row["planet_ID"]
            if pid not in spectral:
                continue
            spec_feat = spectral[pid]                                    # (99,)
            aux_feat  = row[AUX_FEATURES].values.astype(np.float32)     # (5,)
            X_list.append(np.concatenate([spec_feat, aux_feat]))         # (104,)
            ids.append(pid)

        self.X   = np.stack(X_list)
        self.ids = ids
        self.has_labels = gt_csv is not None

        # Build y — 14 targets: [q2_values(7), h_values(7)]  from QuartilesTable
        # h = (Q3 - Q1) / 2  →  the half-width, always positive
        if self.has_labels:
            gt = pd.read_csv(gt_csv).dropna().set_index("planet_ID")
            valid_mask = [pid in gt.index for pid in ids]
            self.X   = self.X[valid_mask]
            self.ids = [pid for pid, m in zip(ids, valid_mask) if m]
            q2 = np.stack([gt.loc[pid, Q2_COLS].values.astype(np.float32) for pid in self.ids])  # (N,7)
            q1 = np.stack([gt.loc[pid, Q1_COLS].values.astype(np.float32) for pid in self.ids])  # (N,7)
            q3 = np.stack([gt.loc[pid, Q3_COLS].values.astype(np.float32) for pid in self.ids])  # (N,7)
            h  = (q3 - q1) / 2.0   # half-width, always >= 0
            self.y = np.concatenate([q2, h], axis=1)   # (N, 14)
        else:
            self.y = None

        # Sanitize NaN / Inf
        self.X = np.nan_to_num(self.X, nan=0.0, posinf=1e6, neginf=-1e6)
        if self.has_labels:
            self.y = np.nan_to_num(self.y, nan=0.0)

        # Fit or apply scalers
        if fit_scalers:
            self.scaler_X = StandardScaler().fit(self.X)
            self.scaler_y = StandardScaler().fit(self.y)
        else:
            self.scaler_X = scaler_X
            self.scaler_y = scaler_y

        self.X = self.scaler_X.transform(self.X).astype(np.float32)
        if self.has_labels:
            self.y = self.scaler_y.transform(self.y).astype(np.float32)

    def __len__(self): return len(self.X)
    def __getitem__(self, i):
        x = torch.tensor(self.X[i])
        if self.has_labels:
            return x, torch.tensor(self.y[i])
        return x


# ─── Model ────────────────────────────────────────────────────────────────────
# Outputs 14 raw values: first 7 = Q2 (median), last 7 = raw spread
# Softplus is applied to last 7 in forward() to ensure h > 0
class CompositionNet(nn.Module):
    def __init__(self, in_dim=104):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(in_dim, 512), nn.BatchNorm1d(512), nn.GELU(), nn.Dropout(0.2),
            nn.Linear(512, 256),    nn.BatchNorm1d(256), nn.GELU(), nn.Dropout(0.2),
            nn.Linear(256, 128),    nn.BatchNorm1d(128), nn.GELU(),
            nn.Linear(128, 14),     # 7 medians + 7 raw spreads
        )
        self.softplus = nn.Softplus()  # maps raw spread -> positive h

    def forward(self, x):
        out = self.net(x)              # (B, 14)
        q2  = out[:, :7]              # medians — unconstrained
        h   = self.softplus(out[:, 7:])  # half-widths — always > 0
        return torch.cat([q2, h], dim=1)  # (B, 14)


# ─── Train ────────────────────────────────────────────────────────────────────
def train():
    print(f"Device: {DEVICE}")
    print("Loading dataset...")
    # Train on 6,766 valid QuartilesTable rows (real Q1/Q2/Q3 from MCMC)
    full_ds = ExoDataset(TRAIN_HDF5, TRAIN_AUX, TRAIN_QT, fit_scalers=True)
    print(f"Dataset: {len(full_ds)} planets | X: {full_ds.X.shape} | y: {full_ds.y.shape} (14 = 7 medians + 7 half-widths)")

    n_val  = int(len(full_ds) * VAL_SPLIT)
    n_train = len(full_ds) - n_val
    train_ds, val_ds = torch.utils.data.random_split(full_ds, [n_train, n_val])

    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True,  num_workers=0)
    val_loader   = DataLoader(val_ds,   batch_size=BATCH_SIZE, shuffle=False, num_workers=0)

    model     = CompositionNet().to(DEVICE)
    criterion = nn.MSELoss()
    optimizer = torch.optim.AdamW(model.parameters(), lr=LR, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=EPOCHS)

    best_val_loss = float("inf")
    for epoch in range(1, EPOCHS + 1):
        # ── Train ──
        model.train()
        train_loss = 0.0
        for X, y in train_loader:
            X, y = X.to(DEVICE), y.to(DEVICE)
            optimizer.zero_grad()
            loss = criterion(model(X), y)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            train_loss += loss.item() * len(X)
        train_loss /= n_train

        # ── Validate ──
        model.eval()
        val_loss = 0.0
        with torch.no_grad():
            for X, y in val_loader:
                X, y = X.to(DEVICE), y.to(DEVICE)
                val_loss += criterion(model(X), y).item() * len(X)
        val_loss /= n_val
        scheduler.step()

        print(f"Epoch {epoch:3d}/{EPOCHS} | train={train_loss:.4f} | val={val_loss:.4f}")

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            torch.save(model.state_dict(), "best_model.pt")
            print(f"  ** Saved (val={best_val_loss:.4f})")

    with open("scalers.pkl", "wb") as f:
        pickle.dump({"X": full_ds.scaler_X, "y": full_ds.scaler_y}, f)
    print("\nDone. Saved best_model.pt and scalers.pkl")


# ─── Inference ────────────────────────────────────────────────────────────────
def predict():
    with open("scalers.pkl", "rb") as f:
        scalers = pickle.load(f)

    test_ds = ExoDataset(TEST_HDF5, TEST_AUX, scaler_X=scalers["X"], scaler_y=scalers["y"])
    loader  = DataLoader(test_ds, batch_size=256, shuffle=False)

    model = CompositionNet().to(DEVICE)
    model.load_state_dict(torch.load("best_model.pt", map_location=DEVICE, weights_only=False))
    model.eval()

    raw_preds = []
    with torch.no_grad():
        for X in loader:
            raw_preds.append(model(X.to(DEVICE)).cpu().numpy())
    raw_preds = np.concatenate(raw_preds, axis=0)           # (685, 14) scaled
    raw_preds = scalers["y"].inverse_transform(raw_preds)   # back to original units

    # Split into Q2 (median) and h (half-width) — both in original units
    q2 = raw_preds[:, :7]   # (685, 7)
    h  = raw_preds[:, 7:]   # (685, 7) — already positive (softplus was applied)
    h  = np.abs(h)          # extra safety after inverse_transform

    # Reconstruct Q1 and Q3: equal spacing, always ascending
    # Q1 = Q2 - h <= Q2 <= Q2 + h = Q3
    out = np.empty((len(q2), 21), dtype=np.float32)
    for i in range(7):
        out[:, i*3 + 0] = q2[:, i] - h[:, i]   # Q1
        out[:, i*3 + 1] = q2[:, i]              # Q2 (model median)
        out[:, i*3 + 2] = q2[:, i] + h[:, i]   # Q3

    submission = pd.DataFrame(out, columns=SUBMIT_COLS)
    submission.insert(0, "planet_ID", test_ds.ids)
    submission.to_csv("submission.csv", index=False)
    print(f"Saved submission.csv - {len(submission)} planets")
    print(submission.head(3).to_string())


# ─── Entry Point ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import sys
    mode = sys.argv[1] if len(sys.argv) > 1 else "train"
    if mode == "train":
        train()
    elif mode == "predict":
        predict()
    elif mode == "all":
        train()
        predict()
