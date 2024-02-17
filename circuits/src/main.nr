use dep::std;

fn main(
    secret: Field,
    oldAmount: Field,
    // tree with 8 depth for test, 7 witness
    witnesses: [Field; 8],
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
    witnesses: [Field; 8],
    merkleRoot: Field,
    nullifier: Field,
    amount: Field
) {
    let hash_secretNullifer = std::hash::poseidon::bn254::hash_2([oldAmount, secret]);
    assert(nullifier == hash_secretNullifer);

    // uint112 type like uniswap pool
    let amountOut = amount as u112;
    let amountOld = oldAmount as u112;
    // we can't withdraw more than actual account amount
    assert(amountOut <= amountOld);

    let newAmount = oldAmount - amount;

    // check if leaf match secret and amount
    let hashSecret = std::hash::poseidon::bn254::hash_2([secret, oldAmount]);

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
    let witnesses: [Field;8] = [0; 8];
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
    let witnesses: [Field;2] = [
        0,
        0x2098f5fb9e239eab3ceac3f27b81e481dc3124d55ffed523a839ee8446b64864
    ];
    let hashSecret = std::hash::poseidon::bn254::hash_2([1, 250000000000000000]);
    std::println("hashSecret");
    std::println(hashSecret);
    let root = compute_merkle_root(hashSecret, 0, witnesses);

    std::println("expected root");
    std::println(root);
}

#[test]
fn test_merkle_root2() {
    let witnesses: [Field;2] = [
        0x191e3a4e10e469f9b6408e9ca05581ca1b303ff148377553b1655c04ee0f7caf,
        0x2098f5fb9e239eab3ceac3f27b81e481dc3124d55ffed523a839ee8446b64864
    ];
    let hashSecret = std::hash::poseidon::bn254::hash_2([1, 250000000000000000]);
    let root = compute_merkle_root(hashSecret, 1, witnesses);

    std::println("expected root");
    std::println(root);
}

#[test]
fn test_merkle_root_real() {
    let witnesses: [Field;8] = [
        0x00,
        0x2098f5fb9e239eab3ceac3f27b81e481dc3124d55ffed523a839ee8446b64864,
        0x1069673dcdb12263df301a6ff584a7ec261a44cb9dc68df067a4774460b1f1e1,
        0x18f43331537ee2af2e3d758d50f72106467c6eea50371dd528d57eb2b856d238,
        0x07f9d837cb17b0d36320ffe93ba52345f1b728571a568265caac97559dbc952a,
        0x2b94cf5e8746b3f5c9631f4c5df32907a699c58c94b2ad4d7b5cec1639183f55,
        0x2dee93c5a666459646ea7d22cca9e1bcfed71e6951b953611d11dda32ea09d78,
        0x078295e5a22b84e982cf601eb639597b8b0515a88cb5ac7fa8a4aabe3c87349d
    ];
    let root = compute_merkle_root(
        0x114f2c2ede8989b365da0b08794ddd8f3fc3816e41b1bec42325df8f3d0f0f10,
        0,
        witnesses
    );

    std::println("expected root");
    std::println("0x13572e3b7b640c11dab9c7045d4ed10f862ecb29d579184652f1b3d60ae849c7");

    std::println("calculted root");
    std::println(root);
}

#[test]
fn test_proof() {
    let witnesses: [Field;8] = [
        0x00,
        0x2098f5fb9e239eab3ceac3f27b81e481dc3124d55ffed523a839ee8446b64864,
        0x1069673dcdb12263df301a6ff584a7ec261a44cb9dc68df067a4774460b1f1e1,
        0x18f43331537ee2af2e3d758d50f72106467c6eea50371dd528d57eb2b856d238,
        0x07f9d837cb17b0d36320ffe93ba52345f1b728571a568265caac97559dbc952a,
        0x2b94cf5e8746b3f5c9631f4c5df32907a699c58c94b2ad4d7b5cec1639183f55,
        0x2dee93c5a666459646ea7d22cca9e1bcfed71e6951b953611d11dda32ea09d78,
        0x078295e5a22b84e982cf601eb639597b8b0515a88cb5ac7fa8a4aabe3c87349d
    ];
    let newLeaf:Field = 0x1cb6b64090ca5ba35e66820b61d9686047bbb12dd2aa9e68dd688a1098f9157a;
    let oldLeaf:Field = 0x114f2c2ede8989b365da0b08794ddd8f3fc3816e41b1bec42325df8f3d0f0f10;
    let root = 0x13572e3b7b640c11dab9c7045d4ed10f862ecb29d579184652f1b3d60ae849c7;
    let oldAmount = 0x16345785d8a0000;
    let nullifier = 0x1f8f4058cccb205ef62b75a4357ba9408b2f9d5018736e62ccb16490a7ecfa2e;
    let receiver = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
    let secret = 0x0774f396230c7f0cbc21c9244ae800a42f8a3eef2ee9c2abd398f684307655e1;
    let result = main(secret, oldAmount, witnesses, 0, newLeaf, root, nullifier, oldAmount, receiver, receiver, 0);
    std::println("result withdraw");
    std::println(result);
}

#[test]
fn test_proof_root() {
    let witnesses: [Field;8] = [
        0x00,
        0x2098f5fb9e239eab3ceac3f27b81e481dc3124d55ffed523a839ee8446b64864,
        0x1fcf14f820cf6f47a0a1b951f0ee100be4f2a93d1be97b2cee3605f688a76dcc,
        0x1b7a8e84cfb68bba0a4c57492feff93fab957cd40ccd9be064c3407b15ec592d,
        0x07f9d837cb17b0d36320ffe93ba52345f1b728571a568265caac97559dbc952a,
        0x2b94cf5e8746b3f5c9631f4c5df32907a699c58c94b2ad4d7b5cec1639183f55,
        0x2dee93c5a666459646ea7d22cca9e1bcfed71e6951b953611d11dda32ea09d78,
        0x078295e5a22b84e982cf601eb639597b8b0515a88cb5ac7fa8a4aabe3c87349d
    ];

    let newLeaf:Field = 0x13eaea9d8bf684b3f7d1f67a2e636d4d8c61ab82298d9658074a21f04ec79f87;
    let root = 0x1375682d9bae7f76d72b19abe7e629e36a89429914f51d55fe2442db977dc79a;
    let oldAmount = 0x2386f26fc10000;
    let nullifier = 0x02fe9c374a0efb303b5ca4dbd1ebed95f5980e68be31afe582d2a877467d6a7b;
    let receiver = 0xEcD3AC1898Be94458EBB975Eb7ed10E51B86370E;
    let secret = 0x2fa4ffb03a5e74f2eb712350cfe4d0e85f2ac572640f252033bcb1f078d437a0;
    let result = main(secret, oldAmount, witnesses, 12, newLeaf, root, nullifier, oldAmount, receiver, receiver, 0x0);
    std::println("result withdraw");
    std::println(result);
    /*  "Prover.toml": "secret= \"0x2fa4ffb03a5e74f2eb712350cfe4d0e85f2ac572640f252033bcb1f078d437a0\"\n
      oldAmount= \"0x2386f26fc10000\"\n
      witnesses= [\"0x00\",
      \"0x2098f5fb9e239eab3ceac3f27b81e481dc3124d55ffed523a839ee8446b64864\",
      \"0x1fcf14f820cf6f47a0a1b951f0ee100be4f2a93d1be97b2cee3605f688a76dcc\",
      \"0x1b7a8e84cfb68bba0a4c57492feff93fab957cd40ccd9be064c3407b15ec592d\",
      \"0x07f9d837cb17b0d36320ffe93ba52345f1b728571a568265caac97559dbc952a\",
      \"0x2b94cf5e8746b3f5c9631f4c5df32907a699c58c94b2ad4d7b5cec1639183f55\",
      \"0x2dee93c5a666459646ea7d22cca9e1bcfed71e6951b953611d11dda32ea09d78\",
      \"0x078295e5a22b84e982cf601eb639597b8b0515a88cb5ac7fa8a4aabe3c87349d\"]\n
      leafIndex= \"0x12\"\n
      leaf= \"0x13eaea9d8bf684b3f7d1f67a2e636d4d8c61ab82298d9658074a21f04ec79f87\"\n
      merkleRoot= \"0x1375682d9bae7f76d72b19abe7e629e36a89429914f51d55fe2442db977dc79a\"\n
      nullifier= \"0x02fe9c374a0efb303b5ca4dbd1ebed95f5980e68be31afe582d2a877467d6a7b\"\n
      amount= \"0x2386f26fc10000\"\n
      receiver= \"0xEcD3AC1898Be94458EBB975Eb7ed10E51B86370E\"\n
      relayer= \"0xEcD3AC1898Be94458EBB975Eb7ed10E51B86370E\"\n
      deposit= \"0x0\""*/
}

