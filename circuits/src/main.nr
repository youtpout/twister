use dep::std;

fn main(
    secret: Field,
    oldAmount: Field,
    // tree with 16 depth for test, 15 witness
    witnesses: [Field; 15],
    leafIndex: Field,
    leaf: pub Field,
    merkleRoot: pub Field,
    nullifier: pub Field,
    amount: pub Field,
    receiver: pub Field,
    relayer: pub Field,
    deposit: pub Field
) {
    if deposit == 1 {
        // we check on deposit if the user deposit the correct amount of eth
        assert(oldAmount == amount);
        let newLeaf = std::hash::poseidon::bn254::hash_2([secret, amount]);
        if (leaf != 0) {
            // verify only if leaf, so we can generate lead in first place and verify it on deposit
            assert(newLeaf == leaf);
        }
    } else {
        // we need to define relayer and receiver to withdraw, relayer and receiver can be the same account
        assert(receiver != 0);
        assert(relayer != 0);
        checkWithdraw(secret, oldAmount, leaf, leafIndex, witnesses, merkleRoot, nullifier, amount);
    }
}

fn checkWithdraw(
    secret: Field,
    oldAmount: Field,
    leaf: Field,
    leafIndex: Field,
    witnesses: [Field; 15],
    merkleRoot: Field,
    nullifier: Field,
    amount: Field
) {
    let hash_secretNullifer = std::hash::pedersen_hash([secret, oldAmount]);
    assert(nullifier == hash_secretNullifer);

    // uint112 type like uniswap pool
    let amountOut = amount as u112;
    let amountOld = oldAmount as u112;
    // we can't withdraw more than actual account amount
    assert(amountOut <= amountOld);

    let newAmount = oldAmount - amount;

    // check if leaf match secret and amount
    let hashSecret = std::hash::poseidon::bn254::hash_2([oldAmount, secret]);

    let root = compute_merkle_root(hashSecret, leafIndex, witnesses);
    assert(root == merkleRoot);

    // generate new leaf for next withdraw
    let newLeaf = std::hash::poseidon::bn254::hash_2([secret, newAmount]);
    assert(newLeaf == leaf);
}

// update of noir implementation to use poseidon
fn compute_merkle_root<N>(leaf: Field, index: Field, hash_path: [Field; N]) -> Field {
    let n = hash_path.len();
    let index_bits = index.to_le_bits(n as u32);
    let mut current = leaf;
    for i in 0..n {
        let path_bit = index_bits[i] as bool;
        let (hash_left, hash_right) = if path_bit {
            (hash_path[i], current)
        } else {
            (current, hash_path[i])
        };
        current = std::hash::poseidon::bn254::hash_2([hash_left, hash_right]);
        //std::println("current");
        //std::println(current);
    }
    current
}

#[test]
fn test_hash_poseidon() {
    let hash_2 = std::hash::poseidon::bn254::hash_2([1, 1]);
    std::println("hash poseidon 1,1");
    std::println(hash_2);
}

#[test]
fn test_generate_deposit_leaf() {
    let witnesses: [Field;15] = [0; 15];
    let result = main(
        1,
        250000000000000000,
        witnesses,
        0,
        0,
        0,
        0,
        250000000000000000,
        0,
        0,
        1
    );
    std::println("result deposit");
    std::println(result);
}

#[test]
fn test_merkle_root() {
    let witnesses: [Field;15] = [
        0,
        0x2098f5fb9e239eab3ceac3f27b81e481dc3124d55ffed523a839ee8446b64864,
        0x1069673dcdb12263df301a6ff584a7ec261a44cb9dc68df067a4774460b1f1e1,
        0x18f43331537ee2af2e3d758d50f72106467c6eea50371dd528d57eb2b856d238,
        0x07f9d837cb17b0d36320ffe93ba52345f1b728571a568265caac97559dbc952a,
        0x2b94cf5e8746b3f5c9631f4c5df32907a699c58c94b2ad4d7b5cec1639183f55,
        0x2dee93c5a666459646ea7d22cca9e1bcfed71e6951b953611d11dda32ea09d78,
        0x078295e5a22b84e982cf601eb639597b8b0515a88cb5ac7fa8a4aabe3c87349d,
        0x2fa5e5f18f6027a6501bec864564472a616b2e274a41211a444cbe3a99f3cc61,
        0x0e884376d0d8fd21ecb780389e941f66e45e7acce3e228ab3e2156a614fcd747,
        0x1b7201da72494f1e28717ad1a52eb469f95892f957713533de6175e5da190af2,
        0x1f8d8822725e36385200c0b201249819a6e6e1e4650808b5bebc6bface7d7636,
        0x2c5d82f66c914bafb9701589ba8cfcfb6162b0a12acf88a8d0879a0471b5f85a,
        0x14c54148a0940bb820957f5adf3fa1134ef5c4aaa113f4646458f270e0bfbfd0,
        0x190d33b12f986f961e10c0ee44d8b9af11be25588cad89d416118e4bf4ebe80c
    ];
    let hashSecret = std::hash::poseidon::bn254::hash_2([250000000000000000, 1]);
    let root = compute_merkle_root(hashSecret, 0, witnesses);

    std::println("expected root");
    std::println(root);
}
