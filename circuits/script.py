from sindri_labs.sindri import Sindri  

sindri = Sindri(api_key="sindri-Y1qkOKoN734PWkUCxwrJ2a1WhnZtIwLG-Stsk")
sindri.set_verbose_level(1)  # Enable verbose stdout

# Prove the circuit
proof_input_file_path = "./Prover.toml"
with open(proof_input_file_path, "r") as f:
    proof_id = sindri.prove_circuit("twister", f.read())