use dep::std;

fn main(secret: Field, amount: Field) -> pub [Field; 2] {
    let mut result:[Field; 2] = [0; 2];
    let newLeaf = std::hash::poseidon::bn254::hash_2([secret, amount]);
    let nullifier = std::hash::pedersen_hash([amount, secret]);
    result = [newLeaf,nullifier];

    // for each proof we generate new leaf and nullifier for next withdraw
    result
}

#[test]
fn test_generate_nullifier() {
    let result = main(1, 250000000000000000);
    std::println("result deposit");
    std::println(result);
    assert(result[0] == 0x191e3a4e10e469f9b6408e9ca05581ca1b303ff148377553b1655c04ee0f7caf);
    assert(result[1] == 0x1e3c6527094f6f524dcf9a514f823f9c0cdd20fb7f879c7bdf58bd2e7d3e0656);
}

#[test]
fn test_generate_leaf_withdraw() {
    let result = main(1, 100000000000000000);
    std::println("result withdraw");
    std::println(result);
    assert(result[0] == 0x2ebe211e4db42654580ed65e9605fd9685ebf1551b681888a60b25d21449d6a8);
    assert(result[1] == 0x10b370e5ca65bca57a72440efcf3e4e1aae3f050146ea2d926d1c18f92516cce);
}
