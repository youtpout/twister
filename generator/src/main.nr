use dep::std;

fn main(secret: Field, amount: Field) -> pub [Field; 2] {
    let mut result:[Field; 2] = [0; 2];
    let newLeaf = std::hash::poseidon::bn254::hash_2([secret, amount]);
    let nullifier = std::hash::poseidon::bn254::hash_2([amount, secret]);
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
    assert(result[1] == 0x2d7bea6eead28cf6460e4d952afcc7397ca25c3e3dda5724bbb74924de309c9a);
}

#[test]
fn test_generate_leaf_withdraw() {
    let result = main(1, 100000000000000000);
    std::println("result withdraw");
    std::println(result);
    assert(result[0] == 0x2ebe211e4db42654580ed65e9605fd9685ebf1551b681888a60b25d21449d6a8);
    assert(result[1] == 0x304572043463a12e61898c73a7d7dabeb3b89b282d8ad70517a34752d75d3d98);
}
